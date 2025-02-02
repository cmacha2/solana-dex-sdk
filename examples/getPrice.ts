/**
 * Example: Fetching and Subscribing to Token Prices using SolanaDexClient
 * 
 * Requirements:
 * 1. .env file with your keys.
 * 2. A working SolanaDexClient instance.
 */

import { SolanaDexClient } from '../src/SolanaDexClient';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Common token mint addresses
const TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112', // SOL Mint Address
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC Mint Address
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY Mint Address
} as const;

// Initialize SolanaDexClient
const client = new SolanaDexClient(
    process.env.WALLET_SECRET_KEY!,
    process.env.HELIUS_RPC_URL!
);

/**
 * Fetch the price of a token.
 * @param mint - The mint address of the token.
 */
async function fetchPrice(mint: string) {
    console.log(`🔍 Fetching price for token: ${mint}`);
    try {
        const price = await client.getTokenPrice(mint);
        console.log(`✅ Current price for ${mint}: $${price}`);
    } catch (error) {
        console.error(`❌ Failed to fetch price for ${mint}:`, error);
    }
}

/**
 * Subscribe to real-time price updates for a token.
 * @param mint - The mint address of the token.
 */
function subscribeToPrice(mint: string) {
    console.log(`🔔 Subscribing to price updates for token: ${mint}`);
    client.subscribeToPrice(
        mint,
        (price) => {
            console.log(`📈 Price update for ${mint}:`, price);
        },
        5000 // Poll every 5 seconds
    );

    // Unsubscribe after 30 seconds
    setTimeout(() => {
        client.unsubscribeFromPrice(mint);
        console.log(`🔕 Unsubscribed from price updates for token: ${mint}`);
    }, 30000);
}

/**
 * Example usage of fetchPrice and subscribeToPrice.
 */
(async () => {
    console.log('Starting token price examples...');

    // Fetch the price of SOL
    await fetchPrice(TOKENS.SOL);

    // Fetch the price of USDC
    await fetchPrice(TOKENS.USDC);

    // Subscribe to price updates for SOL
    subscribeToPrice(TOKENS.SOL);

    // Subscribe to price updates for RAY
    subscribeToPrice(TOKENS.RAY);
})();
