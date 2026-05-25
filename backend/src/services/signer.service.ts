import { Wallet } from 'ethers';
import { getJsonRpcProvider } from '../config/chain.js';
import type { IWallet } from '../models/Wallet.js';
import { decryptPrivateKey } from '../utils/crypto.js';

/** Creates a connected ethers signer. Caller must clear references after use. */
export function createSignerFromWallet(wallet: IWallet, encryptionKey: string): Wallet {
  const pk = decryptPrivateKey(wallet.encryptedPrivateKey, encryptionKey);
  const provider = getJsonRpcProvider();
  return new Wallet(pk, provider);
}
