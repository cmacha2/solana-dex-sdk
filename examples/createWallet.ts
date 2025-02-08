/**
 * Example: Creating a New Wallet using SolanaDexClient
 *
 * Requirements:
 * 2. A working instance of SolanaDexClient.
 */

import { SolanaDexClient } from '../src/SolanaDexClient';

/**
 * Creates a new wallet locally.
 */
async function createWalletLocal() {
    console.log('🔍 Creating a new wallet');
    try {
        // Using the static createWallet method from SolanaDexClient
        const wallet = SolanaDexClient.createWallet();
        console.log('✅ Wallet created:', wallet);
    } catch (error) {
        console.error('❌ Failed to create wallet:', error);
    }
}

// Execute the function to create the wallet
createWalletLocal();
