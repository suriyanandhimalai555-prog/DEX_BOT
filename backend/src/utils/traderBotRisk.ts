import type { IUser } from '../models/User.js';
import { AppError } from './errors.js';

export interface RiskPolicyInput {
  maxDailyNotionalUSD: number;
  cooldownOnFailureSeconds: number;
  maxConcurrentWallets: number;
}

/** Traders cannot set bot daily notional above their account trade limit (limit requests only). */
export function enforceRiskPolicyForUser(
  riskPolicy: RiskPolicyInput,
  user: IUser
): RiskPolicyInput {
  if (user.role === 'admin') {
    return riskPolicy;
  }

  const limit = user.tradeLimitUSD ?? 1;
  if (riskPolicy.maxDailyNotionalUSD > limit + 1e-6) {
    throw new AppError(
      'FORBIDDEN',
      `Max daily notional cannot exceed your approved trade limit ($${limit.toFixed(2)} USD). Submit a limit increase request first.`,
      403
    );
  }

  return {
    ...riskPolicy,
    maxDailyNotionalUSD: limit,
  };
}
