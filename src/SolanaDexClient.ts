import {
    Keypair,
    Transaction,
    VersionedTransaction,
    sendAndConfirmTransaction,
    Connection,
    PublicKey,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount,
    Account,
} from '@solana/spl-token';
import axios from 'axios';
import bs58 from 'bs58';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { SwapConfig } from './types';

export class SolanaDexClient {
    private connection: Connection;
    private owner: Keypair;
    private readonly txVersion: string = 'V0';

    constructor(secretKey: string, rpcUrl: string) {
        this.owner = Keypair.fromSecretKey(bs58.decode(secretKey));
        this.connection = new Connection(rpcUrl);
    }

    /**
     * Find or create an associated token account for a given mint.
     */
    public async getOrCreateTokenAccount(mint: string): Promise<string> {
        const mintPubkey = new PublicKey(mint);
        const ata = await getAssociatedTokenAddress(
            mintPubkey,
            this.owner.publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        try {
            await getAccount(this.connection, ata);
            console.log(`Token account already exists: ${ata}`);
            return ata.toBase58();
        } catch {
            console.log(`Creating new token account for mint: ${mint}`);
            const transaction = new Transaction().add(
                createAssociatedTokenAccountInstruction(
                    this.owner.publicKey,
                    ata,
                    this.owner.publicKey,
                    mintPubkey,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
            );
            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.owner],
                { commitment: 'confirmed' }
            );
            console.log(`Created token account: ${ata}, tx: ${signature}`);
            return ata.toBase58();
        }
    }

    /**
     * Get the SOL balance of the wallet.
     */
    public async getSolBalance(): Promise<number> {
        const balance = await this.connection.getBalance(this.owner.publicKey);
        console.log(`SOL balance: ${balance / 1e9} SOL`);
        return balance / 1e9; // Convert lamports to SOL
    }

    /**
     * Perform a token swap.
     */
    public async swap(config: SwapConfig): Promise<string[]> {
        console.log('Starting swap process...');
        await this.validatePreSwap(config);
        const priorityFee = await this.getPriorityFee();
        const swapQuote = await this.getSwapQuote(config);
        const swapTxs = await this.getSwapTransactions(swapQuote, priorityFee, config);

        const txBuffers = swapTxs.data.map((tx: any) => Buffer.from(tx.transaction, 'base64'));
        return this.processTransactions(txBuffers);
    }

    // 🔄 Helper Functions for Swap
    private async validatePreSwap(config: SwapConfig): Promise<void> {
        const solBalance = await this.getSolBalance();
        if (solBalance < 0.01) {
            throw new Error('Insufficient SOL balance for transaction fees.');
        }

        if (!config.isInputSol) {
            const inputAccount = await this.getOrCreateTokenAccount(config.inputMint);
            console.log(`Input token account: ${inputAccount}`);
        }

        if (!config.isOutputSol) {
            const outputAccount = await this.getOrCreateTokenAccount(config.outputMint);
            console.log(`Output token account: ${outputAccount}`);
        }
    }

    private async getPriorityFee(): Promise<number> {
        const { data } = await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
        console.log('Priority fee:', data.data.default.h);
        return data.data.default.h;
    }

    private async getSwapQuote(config: SwapConfig) {
        const url = `${API_URLS.SWAP_HOST}/compute/swap-base-in?` +
            `inputMint=${config.inputMint}&` +
            `outputMint=${config.outputMint}&` +
            `amount=${config.amount}&` +
            `slippageBps=${config.slippage * 100}&` +
            `txVersion=${this.txVersion}`;
        const { data } = await axios.get(url);
        if (!data.success) {
            throw new Error(`Swap quote failed: ${data.msg}`);
        }
        console.log('Swap quote:', data);
        return data;
    }

    private async getSwapTransactions(swapResponse: any, priorityFee: number, config: SwapConfig) {
        const inputAccount = config.isInputSol
            ? undefined
            : await this.getOrCreateTokenAccount(config.inputMint);

        const outputAccount = config.isOutputSol
            ? undefined
            : await this.getOrCreateTokenAccount(config.outputMint);

        const payload = {
            computeUnitPriceMicroLamports: String(priorityFee),
            swapResponse,
            txVersion: this.txVersion,
            wallet: this.owner.publicKey.toBase58(),
            wrapSol: config.isInputSol,
            unwrapSol: config.isOutputSol,
            inputAccount: inputAccount || this.owner.publicKey.toBase58(),
            outputAccount: outputAccount || this.owner.publicKey.toBase58(),
        };

        console.log('Requesting swap transactions with payload:', payload);
        const { data } = await axios.post(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, payload);
        if (!data.success) {
            throw new Error(`Swap transaction failed: ${data.msg}`);
        }
        return data;
    }

    private async processTransactions(transactions: Buffer[]): Promise<string[]> {
        const results: string[] = [];
        for (const txBuf of transactions) {
            const tx = VersionedTransaction.deserialize(txBuf);
            tx.sign([this.owner]);
            const txId = await this.connection.sendTransaction(tx, { skipPreflight: true });
            results.push(txId);
            console.log(`Transaction sent: ${txId}`);
            console.log(`🔍 http://solscan.io/tx/${txId}`);
        }
        return results;
    }
}
