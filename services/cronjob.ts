import cron from 'node-cron';
import { rateLimiter } from './rateLimitService';

cron.schedule('0 0 * * *', () => {
    rateLimiter.resetDailyCounter();
    console.info('[CRON] Daily API request counter reset at midnight', new Date().toISOString());
});