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
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  Account,
  createTransferInstruction,
  AccountLayout,
} from "@solana/spl-token";
import axios from "axios";
import bs58 from "bs58";
import { API_URLS } from "@raydium-io/raydium-sdk-v2";
import { SwapConfig, TokenPrice } from "./types";

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
  private readonly rpcUrl: string;
  private readonly owner: Keypair;
  private readonly txVersion: string = "V0";
  private readonly isV0Tx: boolean = true;
  private priceSubscriptions: Map<string, NodeJS.Timer> = new Map();

  /**
   * Creates a new instance of SolanaDexClient
   * @param secretKey - The secret key for the Solana wallet
   * @param rpcUrl - The RPC URL for the Solana network
   */
  constructor(secretKey: string, rpcUrl: string) {
    this.owner = Keypair.fromSecretKey(bs58.decode(secretKey));
    this.connection = new Connection(rpcUrl);
    this.rpcUrl = rpcUrl;
  }

  public static createWallet(): { secretKey: string; walletAddress: string } {
    // Generates a new keypair for the wallet
    const keypair = Keypair.generate();

    // Encodes the secret key to base
    const secretKey = bs58.encode(keypair.secretKey);

    // Retrieves the public key (wallet address) from the keypair
    const walletAddress = keypair.publicKey.toString();

    return { secretKey, walletAddress };
  }

  /**
   * Retrieves the SPL Token accounts owned by the wallet
   * @returns Promise resolving to an array of token accounts
   */
  private async getTokenAccounts() {
    const walletTokenAccounts = await this.connection.getTokenAccountsByOwner(
      this.owner.publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    return walletTokenAccounts.value.map((accountInfo) => ({
      pubkey: accountInfo.pubkey,
      programId: accountInfo.account.owner,
      accountDetails: AccountLayout.decode(accountInfo.account.data),
    }));
  }

  /**
   * Fetches the balance of a specific SPL token for the current user.
   *
   * @param mint - The mint address of the SPL token (in string format).
   * @returns A Promise that resolves to the token balance as a number.
   * @throws An error if the balance cannot be fetched.
   */
  public async getTokenBalance(mint: string): Promise<number> {
    try {
      // Retrieve the user's token accounts
      const userTokenAccounts = await this.getTokenAccounts();

      // Find the token account associated with the mint
      const tokenAccount = userTokenAccounts.find(
        (account) => account.accountDetails.mint.toBase58() === mint
      );

      if (tokenAccount) {
        // Fetch and return the token balance
        const balance = await this.connection.getTokenAccountBalance(
          tokenAccount.pubkey
        );
        return balance.value.uiAmount || 0;
      }

      // If no account is found, return 0
      return 0;
    } catch (error: any) {
      console.error(`Failed to fetch token balance for mint ${mint}:`, error);
      throw new Error(`Error fetching token balance: ${error.message}`);
    }
  }

  public async getSolBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.owner.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error fetching SOL balance:", error);
      throw new Error("Failed to fetch SOL balance");
    }
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
        { commitment: "confirmed" }
      );
      console.log(`Created token account ${ata.toString()}, tx: ${signature}`);
      return ata.toString();
    } catch (error: any) {
      if (error.message.includes("already in use")) {
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
      console.error("Error getting priority fee:", error);
      throw new Error("Failed to get priority fee");
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
      url.searchParams.append("inputMint", config.inputMint);
      url.searchParams.append("outputMint", config.outputMint);
      url.searchParams.append("amount", config.amount.toString());
      url.searchParams.append(
        "slippageBps",
        (config.slippage * 100).toString()
      );
      url.searchParams.append("txVersion", this.txVersion);

      const { data } = await axios.get(url.toString());
      return data;
    } catch (error) {
      console.error("Error getting swap quote:", error);
      if (axios.isAxiosError(error)) {
        console.error("API Response:", error.response?.data);
      }
      throw new Error("Failed to get swap quote");
    }
  }

  /**
   * Retrieves swap transaction details from the DEX API
   * @param swapResponse - The swap quote response
   * @param priorityFee - Current priority fee
   * @param config - Swap configuration parameters
   * @returns Promise resolving to the swap transactions
   */
  private async getSwapTransactions(
    swapResponse: any,
    priorityFee: number,
    config: SwapConfig
  ) {
    try {
      const inputAccount = !config.isInputSol
        ? await this.findAssociatedTokenAddress(config.inputMint)
        : null;

      const outputAccount = !config.isOutputSol
        ? await this.findAssociatedTokenAddress(config.outputMint)
        : null;

      const payload = {
        computeUnitPriceMicroLamports: String(priorityFee),
        swapResponse,
        txVersion: this.txVersion,
        wallet: this.owner.publicKey.toBase58(),
        wrapSol: config.isInputSol,
        unwrapSol: config.isOutputSol,
        inputAccount: inputAccount?.toString(),
        outputAccount: outputAccount?.toString(),
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
      console.error("Error getting swap transactions:", error);
      if (axios.isAxiosError(error)) {
        console.error("API Response:", error.response?.data);
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
        const tx = this.isV0Tx
          ? VersionedTransaction.deserialize(transactions[i])
          : Transaction.from(transactions[i]);

        if (this.isV0Tx) {
          (tx as VersionedTransaction).sign([this.owner]);
          const txId = await this.connection.sendTransaction(
            tx as VersionedTransaction,
            {
              skipPreflight: true,
            }
          );
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
        `Insufficient SOL for fees. Required: 0.01 SOL, Available: ${
          solBalance / 1e9
        } SOL`
      );
    }

    if (!config.isInputSol) {
      const tokenAccount = await this.checkOrCreateTokenAccount(
        config.inputMint
      );
      const account = await this.getTokenAccount(config.inputMint);

      if (!account || Number(account.amount) < config.amount) {
        throw new Error(
          `Insufficient token balance. Required: ${config.amount}, Available: ${
            account ? Number(account.amount) : 0
          }`
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
      const swapTxs = await this.getSwapTransactions(
        swapQuote,
        priorityFee,
        config
      );

      if (!swapTxs?.data) {
        throw new Error(
          `Failed to get swap transactions: ${swapTxs.msg || "Unknown error"}`
        );
      }

      const txBuffers = swapTxs.data.map((tx: any) =>
        Buffer.from(tx.transaction, "base64")
      );

      return this.processTransactions(txBuffers);
    } catch (error) {
      console.error("Swap failed:", error);
      throw error;
    }
  }

  /**
   * Fetch the current price of a token by its mint address.
   * Uses the Jupiter API to retrieve token prices.
   *
   * @param mint - The mint address of the token.
   * @returns The current price of the token in USD, or 0 if unavailable.
   */
  public async getTokenPrice(mint: string): Promise<number> {
    try {
      const response = await axios.get(
        `https://api.jup.ag/price/v2?ids=${mint}`
      );
      return response.data.data[mint]?.price || 0;
    } catch (error) {
      console.error(`Error fetching price for ${mint}:`, error);
      return 0;
    }
  }

  /**
   * Subscribe to real-time price updates for a specific token.
   * The subscription fetches the token price at regular intervals and invokes the provided callback with the price data.
   *
   * @param mint - The mint address of the token to track.
   * @param callback - A callback function that receives the price data.
   *                   The callback is passed an object containing `mint`, `price`, and `timestamp`.
   * @param interval - The polling interval in milliseconds. Defaults to 1000ms (1 second).
   */
  public subscribeToPrice(
    mint: string,
    callback: (price: TokenPrice) => void,
    interval: number = 1000
  ): void {
    if (this.priceSubscriptions.has(mint)) {
      console.log(`Already subscribed to price updates for ${mint}`);
      return;
    }

    const timer = setInterval(async () => {
      try {
        const price = await this.getTokenPrice(mint);
        callback({
          mint,
          price,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`Error in price subscription for ${mint}:`, error);
      }
    }, interval);

    this.priceSubscriptions.set(mint, timer);
  }

  /**
   * Unsubscribe from real-time price updates for a specific token.
   * Stops the polling timer associated with the mint address.
   *
   * @param mint - The mint address of the token to unsubscribe from.
   */
  public unsubscribeFromPrice(mint: string): void {
    const timer = this.priceSubscriptions.get(mint) as
      | NodeJS.Timeout
      | undefined;
    if (timer) {
      clearInterval(timer); // Ensure the timer is cleared properly
      this.priceSubscriptions.delete(mint);
      console.log(`Unsubscribed from price updates for ${mint}`);
    } else {
      console.log(`No active subscription found for ${mint}`);
    }
  }

  async getTokenDecimals(mintAddress: string): Promise<number> {
    try {
        const mintPublicKey = new PublicKey(mintAddress);
        const accountInfo = await this.connection.getParsedAccountInfo(mintPublicKey);

        if (!accountInfo || !accountInfo.value) {
            throw new Error(`No se encontró información para el token ${mintAddress}`);
        }

        const parsedInfo = (accountInfo.value.data as any)?.parsed?.info;
        if (!parsedInfo || typeof parsedInfo.decimals === "undefined") {
            throw new Error(`No se pudieron obtener los decimales del token ${mintAddress}`);
        }

        return parsedInfo.decimals;
    } catch (error) {
        console.error(`❌ Error obteniendo los decimales del token ${mintAddress}:`, error);
        return -1; // Devuelve -1 en caso de error
    }
}

    /**
 * Obtiene los detalles de un token (nombre, símbolo, decimales, etc.) utilizando la lista de tokens de Jupiter.
 * @param mint - La dirección de mint del token.
 * @returns Un objeto con los detalles del token o null si no se encuentra.
 */
    async getTokenInfo(mint: string): Promise<string> {
        try {
          const response = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'my-id',
              method: 'getAsset',
              params: { id: mint },
            }),
          });
    
          const data = await response.json();
    
          if (data.result && data.result.content && data.result.content.metadata) {
            return data.result.content.metadata;
          }
        } catch (error) {
          console.error(`Error al obtener información del token ${mint}:`, error);
        }
    
        // Si no se puede obtener el nombre, devuelve una versión abreviada de la dirección del token
        return mint.slice(0, 4) + '...' + mint.slice(-4);
      }
    

    /**
   * Sends SOL from the connected wallet to another wallet.
   *
   * @param destination - The destination wallet's public key (as a string).
   * @param amount - The amount of SOL to send.
   *                 (Note: This value is in SOL. It will be converted to lamports internally.)
   * @returns Promise resolving to the transaction signature.
   */
  public async sendSol(destination: string, amount: number): Promise<string> {
    try {
      const destPubKey = new PublicKey(destination);
      // Convert SOL to lamports (rounding to the nearest integer)
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);

      // Optionally, check for sufficient balance (leaving a buffer for fees)
      const balance = await this.connection.getBalance(this.owner.publicKey);
      if (balance < lamports + MIN_SOL_BALANCE) {
        throw new Error(
          `Insufficient funds: Available ${
            balance / LAMPORTS_PER_SOL
          } SOL, required ${amount} SOL plus fees.`
        );
      }

      // Create a transaction to transfer SOL
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.owner.publicKey,
          toPubkey: destPubKey,
          lamports,
        })
      );

      // Send and confirm the transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.owner],
        { commitment: "confirmed" }
      );

      console.log(`✅ Transaction successful: ${signature}`);
      return signature;
    } catch (error) {
      console.error("❌ Error sending SOL:", error);
      throw error;
    }
  }

  /**
   * Sends a specific SPL token from the connected wallet to another wallet.
   *
   * @param destination - The destination wallet's public key (as a string).
   * @param mint - The mint address of the token to send.
   * @param amount - The amount of tokens to send (in human-readable format).
   * @returns Promise resolving to the transaction signature.
   */
  public async sendToken(
    destination: string,
    mint: string,
    amount: number
  ): Promise<string> {
    try {
      // 1. Get the token decimals and calculate the amount in the smallest unit.
      const decimals = await this.getTokenDecimals(mint);
      if (decimals < 0) {
        throw new Error("Failed to retrieve token decimals.");
      }
      const tokenAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

      // 2. Get the sender's associated token account for that token.
      const senderTokenAccount = await this.findAssociatedTokenAddress(mint);
      const senderTokenAccountInfo = await getAccount(this.connection, senderTokenAccount);
      if (senderTokenAccountInfo.amount < tokenAmount) {
        throw new Error(
          `Insufficient token balance. Required: ${tokenAmount.toString()} units, Available: ${senderTokenAccountInfo.amount.toString()} units.`
        );
      }

      // 3. Determine the recipient's associated token account for that token.
      const destinationPubKey = new PublicKey(destination);
      const destinationTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(mint),
        destinationPubKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // 4. Prepare the instructions.
      const instructions = [];

      // Check if the recipient's associated token account exists.
      try {
        await getAccount(this.connection, destinationTokenAccount);
      } catch (error) {
        // If it doesn't exist, add an instruction to create it.
        instructions.push(
          createAssociatedTokenAccountInstruction(
            this.owner.publicKey, // Payer for account creation
            destinationTokenAccount,
            destinationPubKey,
            new PublicKey(mint),
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // 5. Create the token transfer instruction.
      const transferInstruction = createTransferInstruction(
        senderTokenAccount,       // Sender's associated token account
        destinationTokenAccount,  // Recipient's associated token account
        this.owner.publicKey,     // Signer (sender)
        tokenAmount,              // Amount to transfer in smallest units
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(transferInstruction);

      // 6. Create and send the transaction.
      const transaction = new Transaction();
      transaction.add(...instructions);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.owner],
        { commitment: "confirmed" }
      );

      console.log(`Token transfer successful: ${signature}`);
      return signature;
    } catch (error) {
      console.error("Error sending token:", error);
      throw error;
    }
  }
}
