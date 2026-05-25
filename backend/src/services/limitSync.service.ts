import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { bnbPriceService } from './bnbPrice.service.js';

class LimitSyncService {
  private lastSyncPrice = 0;

  async syncAllLimits(): Promise<void> {
    const currentPrice = bnbPriceService.getCurrentPrice();
    if (currentPrice <= 0) return;

    const priceChange =
      this.lastSyncPrice > 0
        ? Math.abs(((currentPrice - this.lastSyncPrice) / this.lastSyncPrice) * 100)
        : 100;

    if (this.lastSyncPrice > 0 && priceChange < 2) return;

    const users = await User.find({ isActive: true }).select('id tradeLimitUSD');
    for (const user of users) {
      user.tradeLimitBNB = bnbPriceService.usdToBnb(user.tradeLimitUSD);
      await user.save();
    }

    this.lastSyncPrice = currentPrice;
    if (users.length > 0) {
      logger.info(
        `[LimitSync] Updated ${users.length} users. BNB=$${currentPrice.toFixed(2)}, $1=${bnbPriceService.usdToBnb(1).toFixed(6)} BNB`
      );
    }
  }
}

export const limitSyncService = new LimitSyncService();
