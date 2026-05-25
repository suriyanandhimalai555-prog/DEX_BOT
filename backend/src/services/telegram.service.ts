import axios from 'axios';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

export async function sendTelegramAlert(userId: string, text: string): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (!user?.telegramChatId) return;
    const { TELEGRAM_BOT_TOKEN } = getEnv();
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: user.telegramChatId,
      text,
    });
  } catch (err) {
    logger.error(`Telegram send failed: ${err}`);
  }
}
