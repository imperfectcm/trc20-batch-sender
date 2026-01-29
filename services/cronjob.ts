import cron from 'node-cron';
import { rateLimiter } from './rateLimitService';

cron.schedule('0 0 * * *', () => {
    rateLimiter.resetDailyCounter();
});