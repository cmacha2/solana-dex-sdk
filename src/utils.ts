import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

/**
 * Encuentra o crea una dirección de token asociada (ATA) para un usuario.
 */
export async function findAssociatedTokenAddress(
    ownerPublicKey: PublicKey,
    mint: string
): Promise<PublicKey> {
    return getAssociatedTokenAddress(
        new PublicKey(mint),
        ownerPublicKey
    );
}

/**
 * Convierte lamports a SOL.
 */
export function lamportsToSol(lamports: number): number {
    return lamports / 1e9;
}

/**
 * Convierte SOL a lamports.
 */
export function solToLamports(sol: number): number {
    return sol * 1e9;
}
