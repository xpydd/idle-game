import cron from 'node-cron';
import { logger } from './logger.js';
import { afkService } from '../services/afk.service.js';
import { taskService } from '../services/task.service.js';
import { mineService } from '../services/mine.service.js';
import { shopService } from '../services/shop.service.js';
import { cleanupBlacklist } from './tokenBlacklist.js';

/**
 * 初始化所有定时任务
 */
export function initializeCronJobs() {
  // 能量自然恢复（每小时）
  cron.schedule('0 * * * *', async () => {
    logger.info('执行能量自然恢复任务...');
    try {
      const count = await afkService.recoverEnergyForAllUsers();
      logger.info(`能量恢复完成，处理用户数：${count}`);
    } catch (error) {
      logger.error('能量恢复任务失败:', error);
    }
  });

  // 每日任务重置（每天0点）
  cron.schedule('0 0 * * *', async () => {
    logger.info('执行每日重置任务...');
    try {
      // 重置每日任务
      await taskService.resetDailyTasks();
      
      // 重置商店限购
      const count = await shopService.resetDailyPurchases();
      
      logger.info(`每日重置完成：任务重置成功，清理${count}条商店购买记录`);
    } catch (error) {
      logger.error('每日重置任务失败:', error);
    }
  });

  // 矿点挑战结算（每分钟）
  cron.schedule('* * * * *', async () => {
    try {
      const count = await mineService.settleExpiredChallenges();
      if (count > 0) {
        logger.info(`矿点挑战自动结算完成：${count} 个挑战`);
      }
    } catch (error) {
      logger.error('矿点挑战结算失败:', error);
    }
  });

  // 数据清理（每天凌晨3点）
  cron.schedule('0 3 * * *', async () => {
    logger.info('执行数据清理...');
    try {
      // 清理内存token黑名单
      cleanupBlacklist();
      // 预留：清理旧日志、归档历史记录等
      logger.info('数据清理完成');
    } catch (error) {
      logger.error('数据清理失败:', error);
    }
  });

  // 全平台产出监控（每小时）
  cron.schedule('0 * * * *', async () => {
    try {
      // 预留：统计过去1小时产出，便于后续动态调控
      // 这里仅打点以占位
      logger.info('产出监控心跳');
    } catch (error) {
      logger.error('产出监控失败:', error);
    }
  });

  logger.info('所有定时任务已注册');
}

export default initializeCronJobs;

