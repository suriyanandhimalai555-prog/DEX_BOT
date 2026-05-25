import { z } from 'zod';
import { ethers } from 'ethers';

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'.toLowerCase();

export const priceTokenQuerySchema = z
  .object({
    baseToken: z
      .string()
      .refine((s) => ethers.isAddress(s), 'Invalid baseToken')
      .transform((s) => ethers.getAddress(s)),
    quoteToken: z.union([
      z.literal('NATIVE'),
      z
        .string()
        .refine((s) => ethers.isAddress(s), 'Invalid quoteToken')
        .transform((s) => ethers.getAddress(s)),
    ]),
    dexVersion: z.enum(['v2', 'v3']),
    dex: z.enum(['pancakeswap', 'uniswap']).optional().default('pancakeswap'),
    baseDecimals: z.coerce.number().int().min(0).max(36).optional(),
  })
  .refine(
    (d) => {
      const qAddr = d.quoteToken === 'NATIVE' ? WBNB : d.quoteToken.toLowerCase();
      return d.baseToken.toLowerCase() !== qAddr;
    },
    { message: 'baseToken and quoteToken must differ', path: ['baseToken'] }
  );

export type PriceTokenQuery = z.infer<typeof priceTokenQuerySchema>;
