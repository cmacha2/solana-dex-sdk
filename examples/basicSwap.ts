import { SolanaDexClient } from '../src/SolanaDexClient';
import dotenv from 'dotenv';
dotenv.config();

const client = new SolanaDexClient(
    process.env.WALLET_SECRET_KEY!,
    process.env.HELIUS_RPC_URL!
);

const swapConfig = {
    inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    outputMint: 'So11111111111111111111111111111111111111112', // SOL
    amount: 1000000, // 1 USDC (6 decimales)
    slippage: 1, // 1% tolerancia
    isInputSol: false, // Entrada no es SOL
    isOutputSol: true, // Salida es SOL
};

(async () => {
    try {
        const txIds = await client.swap(swapConfig);
        console.log('Swap completed successfully:', txIds);
    } catch (error) {
        console.error('Swap failed:', error);
    }
})();
