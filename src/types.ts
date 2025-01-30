export interface SwapConfig {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippage: number;
    isInputSol: boolean;
    isOutputSol: boolean;
}
