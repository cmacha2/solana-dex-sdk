import { SolanaDexClient } from '../src/SolanaDexClient';
import dotenv from 'dotenv';

// Load environment variables from your .env file
dotenv.config();

// Initialize the SolanaDexClient with your wallet's secret key and the RPC URL
const client = new SolanaDexClient(
  process.env.WALLET_SECRET_KEY!,
  process.env.HELIUS_RPC_URL!
);

/**
 * Sends SOL to a specified destination wallet.
 */
async function sendSOLDemo() {
  try {
    // Replace with the destination wallet's public key (as a string)
    const destinationWallet = 'YOUR_DESTINATION_WALLET_PUBLIC_KEY';
    // Define the amount of SOL to send (in SOL units)
    const amountToSend = 0.1; // For example, 0.1 SOL

    // Call the sendSol method
    const txSignature = await client.sendSol(destinationWallet, amountToSend);
    console.log(`Transaction successful! Signature: ${txSignature}`);
  } catch (error) {
    console.error('Error sending SOL:', error);
  }
}

// Execute the demo function
sendSOLDemo();
