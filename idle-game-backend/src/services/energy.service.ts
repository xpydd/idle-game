import { prisma } from '../db/prisma.js';
import { TransactionType, TransactionSource } from '@prisma/client';
import { walletService } from './wallet.service.js';
import logger from '../utils/logger.js';

/**
 * 能量购买服务
 */
class EnergyService {
  // 配置常量
  private readonly ENERGY_PRICE = 50; // 10能量 = 50贝壳
  private readonly ENERGY_UNIT = 10; // 每次购买单位
  private readonly DAILY_PURCHASE_LIMIT = 200; // 每日购买上限

  /**
   * 购买能量
   */
  async buyEnergy(userId: string, quantity: number): Promise<{
    success: boolean;
    message: string;
    data?: {
      energyGained: number;
      shellCost: number;
      newEnergyBalance: number;
      todayPurchased: number;
      remaining: number;
    };
  }> {
    try {
      // 参数校验
      if (!quantity || quantity <= 0) {
        return { success: false, message: '购买数量必须大于0' };
      }

      if (quantity % this.ENERGY_UNIT !== 0) {
        return { success: false, message: `购买数量必须是${this.ENERGY_UNIT}的倍数` };
      }

      // 查询今日购买记录
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayPurchases = await prisma.energyLedger.aggregate({
        where: {
          userId,
          source: 'PURCHASE',
          timestamp: {
            gte: today,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const todayPurchased = todayPurchases._sum.amount || 0;

      // 检查是否超过每日上限
      if (todayPurchased + quantity > this.DAILY_PURCHASE_LIMIT) {
        const remaining = this.DAILY_PURCHASE_LIMIT - todayPurchased;
        return {
          success: false,
          message: `今日购买上限为${this.DAILY_PURCHASE_LIMIT}点能量，您已购买${todayPurchased}点，还可购买${remaining}点`,
        };
      }

      // 计算贝壳消耗
      const shellCost = (quantity / this.ENERGY_UNIT) * this.ENERGY_PRICE;

      // 查询用户贝壳余额
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        select: { shellBalance: true },
      });

      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      if (wallet.shellBalance < shellCost) {
        return {
          success: false,
          message: `贝壳不足，需要${shellCost}🐚，当前${wallet.shellBalance}🐚`,
        };
      }

      // 执行事务
      const result = await prisma.$transaction(async (tx) => {
        // 1. 扣除贝壳
        await walletService.updateShells(
          userId,
          -shellCost,
          TransactionType.SPEND,
          TransactionSource.ENERGY_PURCHASE,
          `购买${quantity}点能量`,
          tx
        );

        // 2. 增加能量
        const updatedWallet = await tx.wallet.update({
          where: { userId },
          data: {
            energy: {
              increment: quantity,
            },
          },
          select: { energy: true },
        });

        // 3. 记录能量流水
        await tx.energyLedger.create({
          data: {
            userId,
            amount: quantity,
            source: 'PURCHASE',
            description: `购买能量，消耗${shellCost}贝壳`,
          },
        });

        return updatedWallet;
      });

      logger.info(`用户购买能量：userId=${userId}, quantity=${quantity}, cost=${shellCost}`);

      return {
        success: true,
        message: '购买成功',
        data: {
          energyGained: quantity,
          shellCost,
          newEnergyBalance: result.energy,
          todayPurchased: todayPurchased + quantity,
          remaining: this.DAILY_PURCHASE_LIMIT - todayPurchased - quantity,
        },
      };
    } catch (error: any) {
      logger.error('购买能量失败', { error: error.message, userId, quantity });
      return { success: false, message: '购买失败，请稍后重试' };
    }
  }

  /**
   * 查询今日购买情况
   */
  async getTodayPurchase(userId: string): Promise<{
    todayPurchased: number;
    remaining: number;
    dailyLimit: number;
    energyPrice: number;
    energyUnit: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPurchases = await prisma.energyLedger.aggregate({
      where: {
        userId,
        source: 'PURCHASE',
        timestamp: {
          gte: today,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const todayPurchased = todayPurchases._sum.amount || 0;

    return {
      todayPurchased,
      remaining: this.DAILY_PURCHASE_LIMIT - todayPurchased,
      dailyLimit: this.DAILY_PURCHASE_LIMIT,
      energyPrice: this.ENERGY_PRICE,
      energyUnit: this.ENERGY_UNIT,
    };
  }
}

export const energyService = new EnergyService();

