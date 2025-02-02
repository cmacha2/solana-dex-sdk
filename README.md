# Solana DEX SDK 🚀

A simple and powerful JavaScript SDK for interacting with **Raydium** and other **DEXs on Solana**.  
Designed for **developers, traders, and DeFi enthusiasts**, this library enables seamless token swaps with **minimal configuration**.

## 🌟 Features
✔️ **Easy-to-use API** for swapping tokens on Raydium.  
✔️ **Automatic handling** of associated token accounts.  
✔️ **Support for Solana transactions** using the latest Solana Web3 SDK.  
✔️ **Built-in priority fee optimization** for fast transactions.  
✔️ **Written in TypeScript** for strong typing and reliability.  
✔️ **Future support** for **Jupiter, Orca, and other Solana DEXs**.  


📦 Installation
You can install the package using npm:
```
npm install solana-dex-sdk
```
Or with yarn:
```
yarn add solana-dex-sdk
```

🚀 Usage Example
This is how you can quickly set up and perform a token swap on Raydium:

```
const { SolanaDexClient } = require('solana-dex-sdk');
require('dotenv').config();

// Initialize the SolanaDexClient with your secret key and Solana RPC URL
const swapper = new SolanaDexClient(
    process.env.WALLET_SECRET_KEY, // Secret key from .env
    process.env.HELIUS_RPC_URL    // Solana RPC URL from .env
);

// Define the swap configuration
const swapConfig = {
    inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    outputMint: 'So11111111111111111111111111111111111111112',  // SOL
    amount: 1000000, // 1 USDC (USDC has 6 decimals)
    slippage: 1, // 1% slippage tolerance
    isInputSol: false,
    isOutputSol: true,
};

// Perform the swap
const performSwap = async () => {
    try {
        const txIds = await swapper.swap(swapConfig);
        console.log('✅ Swap completed:', txIds);
    } catch (error) {
        console.error('❌ Swap failed:', error);
    }
};

performSwap();
```

⚙️ Configuration
You need a Solana RPC URL and a private key to initialize the swapper.
It's recommended to use Helius, QuickNode, or an RPC provider for better performance.

```
# .env file (for security, don't expose your private key)
WALLET_SECRET_KEY="YOUR_PRIVATE_KEY"
HELIUS_RPC_URL="https://api.helius.xyz/v0/?api-key=YOUR_API_KEY" # It Could be https://api.mainnet-beta.solana.com
```

🛠 Supported Functionalities
✅ Token Swaps (SOL, USDC, RAY, and all SPL tokens).
✅ Auto-create Associated Token Accounts if they don’t exist.
✅ Transaction processing and signing.
✅ Customizable slippage and priority fees.
⏳ (Coming Soon): Support for multiple DEXs (Jupiter, Orca, etc.).

📖 API Documentation
Method	Description
new RaydiumSwap(secretKey: string, rpcUrl: string)	Initializes the swapper
swap(config: SwapConfig): Promise<string[]>	Executes a token swap
checkOrCreateTokenAccount(mint: string): Promise<string>	Ensures a valid token account
getPriorityFee(): Promise<number>	Fetches optimal priority fee

💡 Contributing
We welcome contributions! If you want to improve this SDK:

Fork this repository.
Create a new branch (feature-branch).
Commit your changes.
Open a pull request.
📜 License
This project is open-source and released under the MIT License.

📌 GitHub Repository: GitHub Link

🌟 Star this repo if you find it useful! 🚀🔥
