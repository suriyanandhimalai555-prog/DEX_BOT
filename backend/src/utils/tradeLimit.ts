import { User } from '../models/User.js';
import { bnbPriceService } from '../services/bnbPrice.service.js';

export async function recalculateUserLimitBNB(userId: string): Promise<number> {
  const user = await User.findById(userId);
  if (!user) throw new Error(`User ${userId} not found`);
  user.tradeLimitBNB = bnbPriceService.usdToBnb(user.tradeLimitUSD);
  await user.save();
  return user.tradeLimitBNB;
}

export interface CapResult {
  amountWei: bigint;
  wasCapped: boolean;
  requestedBNB?: number;
  cappedToBNB?: number;
  limitUSD?: number;
  bnbPriceAtTrade?: number;
}

/** Cap quote-side spend (wei) to user's tradeLimitBNB. */
export async function capWeiToUserLimit(
  userId: string,
  amountWei: bigint,
  isQuoteSideSpend: boolean
): Promise<CapResult> {
  if (!isQuoteSideSpend) {
    return { amountWei, wasCapped: false };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { amountWei, wasCapped: false };
  }

  const requestedBNB = Number(amountWei) / 1e18;
  const limitBNB = user.tradeLimitBNB;
  const bnbPrice = bnbPriceService.getCurrentPrice();

  if (requestedBNB <= limitBNB) {
    return { amountWei, wasCapped: false };
  }

  const cappedWei = BigInt(Math.floor(limitBNB * 1e18));
  return {
    amountWei: cappedWei,
    wasCapped: true,
    requestedBNB,
    cappedToBNB: limitBNB,
    limitUSD: user.tradeLimitUSD,
    bnbPriceAtTrade: bnbPrice,
  };
}
