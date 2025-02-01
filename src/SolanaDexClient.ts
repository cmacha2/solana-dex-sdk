/**
 * @file SolanaDexClient.ts
 * @description A TypeScript client for interacting with Solana DEX (Decentralized Exchange)
 * Provides functionality for token swaps and account management on the Solana blockchain.
 */

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

/**
 * Minimum SOL balance required for transaction fees (in lamports)
 */
const MIN_SOL_BALANCE = 10000000; // 0.01 SOL

/**
 * Client for interacting with Solana DEX
 * Handles token swaps and associated account management
 */
export class SolanaDexClient {
    private readonly connection: Connection;
    private readonly owner: Keypair;
    private readonly txVersion: string = 'V0';
    private readonly isV0Tx: boolean = true;

    /**
     * Creates a new instance of SolanaDexClient
     * @param secretKey - The secret key for the Solana wallet
     * @param rpcUrl - The RPC URL for the Solana network
     */
    constructor(secretKey: string, rpcUrl: string) {
        this.owner = Keypair.fromSecretKey(bs58.decode(secretKey));
        this.connection = new Connection(rpcUrl);
    }

    /**
     * Finds the associated token address for a given mint
     * @param mint - The mint address of the token
     * @returns Promise resolving to the associated token address
     */
    private async findAssociatedTokenAddress(mint: string): Promise<PublicKey> {
        const mintPubkey = new PublicKey(mint);
        return await getAssociatedTokenAddress(
            mintPubkey,
            this.owner.publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
    }

    /**
     * Retrieves token account information
     * @param mint - The mint address of the token
     * @returns Promise resolving to the account information or null if not found
     */
    private async getTokenAccount(mint: string): Promise<Account | null> {
        try {
            const ata = await this.findAssociatedTokenAddress(mint);
            return await getAccount(this.connection, ata);
        } catch (error) {
            console.log(`No token account found for mint ${mint}`);
            return null;
        }
    }

    /**
     * Creates a new token account for a given mint
     * @param mint - The mint address of the token
     * @returns Promise resolving to the address of the created account
     */
    private async createTokenAccount(mint: string): Promise<string> {
        const mintPubkey = new PublicKey(mint);
        const ata = await this.findAssociatedTokenAddress(mint);

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

        try {
            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.owner],
                { commitment: 'confirmed' }
            );
            console.log(`Created token account ${ata.toString()}, tx: ${signature}`);
            return ata.toString();
        } catch (error: any) {
            if (error.message.includes('already in use')) {
                console.log(`Token account ${ata.toString()} already exists`);
                return ata.toString();
            }
            throw error;
        }
    }

    /**
     * Ensures a token account exists, creating it if necessary
     * @param mint - The mint address of the token
     * @returns Promise resolving to the token account address
     */
    private async checkOrCreateTokenAccount(mint: string): Promise<string> {
        const account = await this.getTokenAccount(mint);
        
        if (!account) {
            console.log(`Creating new token account for mint ${mint}`);
            return await this.createTokenAccount(mint);
        }
        
        return account.address.toString();
    }

    /**
     * Fetches the current priority fee from the API
     * @returns Promise resolving to the priority fee value
     */
    private async getPriorityFee(): Promise<number> {
        try {
            const { data } = await axios.get(
                `${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`
            );
            return data.data.default.h;
        } catch (error) {
            console.error('Error getting priority fee:', error);
            throw new Error('Failed to get priority fee');
        }
    }

    /**
     * Retrieves a swap quote from the DEX API
     * @param config - Swap configuration parameters
     * @returns Promise resolving to the swap quote response
     */
    private async getSwapQuote(config: SwapConfig) {
        try {
            const url = new URL(`${API_URLS.SWAP_HOST}/compute/swap-base-in`);
            url.searchParams.append('inputMint', config.inputMint);
            url.searchParams.append('outputMint', config.outputMint);
            url.searchParams.append('amount', config.amount.toString());
            url.searchParams.append('slippageBps', (config.slippage * 100).toString());
            url.searchParams.append('txVersion', this.txVersion);

            const { data } = await axios.get(url.toString());
            return data;
        } catch (error) {
            console.error('Error getting swap quote:', error);
            if (axios.isAxiosError(error)) {
                console.error('API Response:', error.response?.data);
            }
            throw new Error('Failed to get swap quote');
        }
    }

    /**
     * Retrieves swap transaction details from the DEX API
     * @param swapResponse - The swap quote response
     * @param priorityFee - Current priority fee
     * @param config - Swap configuration parameters
     * @returns Promise resolving to the swap transactions
     */
    private async getSwapTransactions(swapResponse: any, priorityFee: number, config: SwapConfig) {
        try {
            const inputAccount = !config.isInputSol ? 
                await this.findAssociatedTokenAddress(config.inputMint) : null;
            
            const outputAccount = !config.isOutputSol ? 
                await this.findAssociatedTokenAddress(config.outputMint) : null;

            const payload = {
                computeUnitPriceMicroLamports: String(priorityFee),
                swapResponse,
                txVersion: this.txVersion,
                wallet: this.owner.publicKey.toBase58(),
                wrapSol: config.isInputSol,
                unwrapSol: config.isOutputSol,
                inputAccount: inputAccount?.toString(),
                outputAccount: outputAccount?.toString()
            };

            const { data: swapTransactions } = await axios.post(
                `${API_URLS.SWAP_HOST}/transaction/swap-base-in`,
                payload
            );

            if (!swapTransactions.success) {
                throw new Error(`Swap transaction failed: ${swapTransactions.msg}`);
            }

            return swapTransactions;
        } catch (error: any) {
            console.error('Error getting swap transactions:', error);
            if (axios.isAxiosError(error)) {
                console.error('API Response:', error.response?.data);
            }
            throw new Error(`Failed to get swap transactions: ${error.message}`);
        }
    }

    /**
     * Processes and sends a series of transactions
     * @param transactions - Array of transaction buffers to process
     * @returns Promise resolving to array of transaction signatures
     */
    private async processTransactions(transactions: Buffer[]): Promise<string[]> {
        const results: string[] = [];

        for (let i = 0; i < transactions.length; i++) {
            try {
                const tx = this.isV0Tx ?
                    VersionedTransaction.deserialize(transactions[i]) :
                    Transaction.from(transactions[i]);

                if (this.isV0Tx) {
                    (tx as VersionedTransaction).sign([this.owner]);
                    const txId = await this.connection.sendTransaction(tx as VersionedTransaction, {
                        skipPreflight: true
                    });
                    await this.connection.getLatestBlockhash();
                    results.push(txId);
                    console.log(`Transaction ${i + 1} sent: ${txId}`);
                    console.log(`🔍 http://solscan.io/tx/${txId}`);
                } else {
                    const transaction = tx as Transaction;
                    transaction.sign(this.owner);
                    const txId = await sendAndConfirmTransaction(
                        this.connection,
                        transaction,
                        [this.owner],
                        { skipPreflight: true }
                    );
                    results.push(txId);
                }
            } catch (error) {
                console.error(`Error processing transaction ${i + 1}:`, error);
                throw error;
            }
        }

        return results;
    }

    /**
     * Validates pre-swap conditions
     * @param config - Swap configuration parameters
     * @throws Error if validation fails
     */
    private async validatePreSwap(config: SwapConfig): Promise<void> {
        const solBalance = await this.connection.getBalance(this.owner.publicKey);
        
        if (solBalance < MIN_SOL_BALANCE) {
            throw new Error(
                `Insufficient SOL for fees. Required: 0.01 SOL, Available: ${solBalance / 1e9} SOL`
            );
        }

        if (!config.isInputSol) {
            const tokenAccount = await this.checkOrCreateTokenAccount(config.inputMint);
            const account = await this.getTokenAccount(config.inputMint);
            
            if (!account || Number(account.amount) < config.amount) {
                throw new Error(
                    `Insufficient token balance. Required: ${config.amount}, Available: ${account ? Number(account.amount) : 0}`
                );
            }
        }

        if (!config.isOutputSol) {
            await this.checkOrCreateTokenAccount(config.outputMint);
        }
    }

    /**
     * Executes a token swap based on the provided configuration
     * @param config - Swap configuration parameters
     * @returns Promise resolving to array of transaction signatures
     * @throws Error if the swap fails
     */
    public async swap(config: SwapConfig): Promise<string[]> {
        try {
            await this.validatePreSwap(config);
            
            const priorityFee = await this.getPriorityFee();
            const swapQuote = await this.getSwapQuote(config);
            const swapTxs = await this.getSwapTransactions(swapQuote, priorityFee, config);

            if (!swapTxs?.data) {
                throw new Error(`Failed to get swap transactions: ${swapTxs.msg || 'Unknown error'}`);
            }

            const txBuffers = swapTxs.data.map((tx: any) => 
                Buffer.from(tx.transaction, 'base64')
            );
            
            return this.processTransactions(txBuffers);
        } catch (error) {
            console.error('Swap failed:', error);
            throw error;
        }
    }
}