"use strict";
/**
 * Simple examples of how to buy and sell tokens using SolanaDexClient
 *
 * Requirements:
 * 1. .env file with your keys
 * 2. For buying: Need USDC in your wallet
 * 3. For selling: Need the token you want to sell
 * 4. Always need some SOL for fees (0.01 SOL minimum)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SolanaDexClient_1 = require("../src/SolanaDexClient");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Common token addresses
const TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
};
// Token decimals
const DECIMALS = {
    SOL: 9, // 1 SOL = 1000000000 lamports
    USDC: 6, // 1 USDC = 1000000 units
    USDT: 6,
    RAY: 6,
};
// Initialize client
const client = new SolanaDexClient_1.SolanaDexClient(process.env.WALLET_SECRET_KEY, process.env.HELIUS_RPC_URL);
/**
 * Buy tokens using USDC
 * Example: buyWithUSDC(100, 'SOL') - Buys SOL with 100 USDC
 */
function buyWithUSDC(usdcAmount, tokenToBuy) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n🔄 Buying ${tokenToBuy} with ${usdcAmount} USDC...`);
        console.log('Make sure you have enough USDC in your wallet!');
        const config = {
            inputMint: TOKENS.USDC,
            outputMint: TOKENS[tokenToBuy],
            amount: usdcAmount * Math.pow(10, DECIMALS.USDC), // Convert to USDC units
            slippage: 1, // 1% slippage
            isInputSol: false,
            isOutputSol: tokenToBuy === 'SOL'
        };
        try {
            const txIds = yield client.swap(config);
            console.log('\n✅ Purchase successful!');
            console.log('Transaction:', `https://solscan.io/tx/${txIds[0]}`);
            return txIds;
        }
        catch (error) {
            console.error('\n❌ Purchase failed:', error);
            throw error;
        }
    });
}
/**
 * Sell tokens for USDC
 * Example: sellForUSDC(1, 'SOL') - Sells 1 SOL for USDC
 */
function sellForUSDC(amount, tokenToSell) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n🔄 Selling ${amount} ${tokenToSell} for USDC...`);
        console.log(`Make sure you have enough ${tokenToSell} in your wallet!`);
        const config = {
            inputMint: TOKENS[tokenToSell],
            outputMint: TOKENS.USDC,
            amount: amount * Math.pow(10, DECIMALS[tokenToSell]), // Convert to token units
            slippage: 1, // 1% slippage
            isInputSol: tokenToSell === 'SOL',
            isOutputSol: false
        };
        try {
            const txIds = yield client.swap(config);
            console.log('\n✅ Sale successful!');
            console.log('Transaction:', `https://solscan.io/tx/${txIds[0]}`);
            return txIds;
        }
        catch (error) {
            console.error('\n❌ Sale failed:', error);
            throw error;
        }
    });
}
sellForUSDC(1, 'SOL')
    .then(() => console.log('Sell order completed'))
    .catch(console.error);
// Examples of how to use:
// Example 1: Buy SOL with USDC
// Requirements: 1 USDC in wallet +  SOL for fees
// buyWithUSDC(1, 'SOL')
//     .then(() => console.log('Buy order completed'))
//     .catch(console.error);
// Example 2: Sell SOL for USDC
// Requirements: 1 SOL in wallet +  SOL for fees
/*
sellForUSDC(1, 'SOL')
    .then(() => console.log('Sell order completed'))
    .catch(console.error);
*/
// Example 3: Buy RAY with USDC
// Requirements: 50 USDC in wallet +  SOL for fees
/*
buyWithUSDC(50, 'RAY')
    .then(() => console.log('Buy order completed'))
    .catch(console.error);
*/
// Example 4: Sell RAY for USDC
// Requirements: 10 RAY in wallet + SOL for fees
/*
sellForUSDC(10, 'RAY')
    .then(() => console.log('Sell order completed'))
    .catch(console.error);
*/ 
