import { SolanaDexClient } from '../src/SolanaDexClient';
import { SwapConfig } from '../src/types';
import dotenv from 'dotenv';
dotenv.config();

describe('SolanaDexClient Tests', () => {
    let client: SolanaDexClient;

    beforeAll(() => {
        client = new SolanaDexClient(
            process.env.WALLET_SECRET_KEY as string,
            process.env.HELIUS_RPC_URL as string
        );
    });

    test('Should perform a successful swap', async () => {
        const config: SwapConfig = {
            inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            outputMint: 'So11111111111111111111111111111111111111112',
            amount: 1000000,
            slippage: 1,
            isInputSol: false,
            isOutputSol: true
        };

        const txIds = await client.swap(config);
        expect(txIds.length).toBeGreaterThan(0);
    });

    test('Should return SOL balance', async () => {
        const solBalance = await client.getSolBalance();
        expect(solBalance).toBeGreaterThan(0);
    });
});
