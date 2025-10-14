import { prisma } from '../db/prisma.js';
import { Currency, TransactionType } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * 钱包服务
 */
class WalletService {
  /**
   * 获取用户钱包余额
   */
  async getBalance(userId: string) {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        // 如果钱包不存在，创建一个
        const newWallet = await prisma.wallet.create({
          data: {
            userId,
            gemBalance: 0,
            shellBalance: 0,
            energy: 100
          }
        });
        return newWallet;
      }

      return wallet;
    } catch (error: any) {
      logger.error('获取钱包余额失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 更新宝石余额
   * 带事务保证，记录流水
   */
  async updateGems(
    userId: string,
    amount: number,
    type: TransactionType,
    source?: string,
    description?: string,
    tx?: any
  ) {
    try {
      const executor = async (client: any) => {
        const wallet = await client.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new Error('钱包不存在');
        }
        if (amount < 0 && wallet.gemBalance + amount < 0) {
          throw new Error('宝石余额不足');
        }
        const updatedWallet = await client.wallet.update({
          where: { userId },
          data: { gemBalance: { increment: amount } }
        });
        await client.transaction.create({
          data: {
            userId,
            type,
            amount: Math.abs(amount),
            currency: Currency.GEM,
            source,
            description
          }
        });
        logger.info(`宝石余额更新：userId=${userId}, amount=${amount}, newBalance=${updatedWallet.gemBalance}`);
        return updatedWallet;
      };
      if (tx) {
        return await executor(tx);
      }
      return await prisma.$transaction(executor);
    } catch (error: any) {
      logger.error('更新宝石余额失败', { error: error.message, userId, amount });
      throw error;
    }
  }

  /**
   * 更新贝壳余额
   * 带事务保证，记录流水
   */
  async updateShells(
    userId: string,
    amount: number,
    type: TransactionType,
    source?: string,
    description?: string,
    tx?: any
  ) {
    try {
      const executor = async (client: any) => {
        const wallet = await client.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new Error('钱包不存在');
        }
        if (amount < 0 && wallet.shellBalance + amount < 0) {
          throw new Error('贝壳余额不足');
        }
        const updatedWallet = await client.wallet.update({
          where: { userId },
          data: { shellBalance: { increment: amount } }
        });
        await client.transaction.create({
          data: {
            userId,
            type,
            amount: Math.abs(amount),
            currency: Currency.SHELL,
            source,
            description
          }
        });
        logger.info(`贝壳余额更新：userId=${userId}, amount=${amount}, newBalance=${updatedWallet.shellBalance}`);
        return updatedWallet;
      };
      if (tx) {
        return await executor(tx);
      }
      return await prisma.$transaction(executor);
    } catch (error: any) {
      logger.error('更新贝壳余额失败', { error: error.message, userId, amount });
      throw error;
    }
  }

  /**
   * 更新能量值
   */
  async updateEnergy(
    userId: string,
    amount: number,
    source: string
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId }
        });

        if (!wallet) {
          throw new Error('钱包不存在');
        }

        // 能量上限100
        const newEnergy = Math.min(100, Math.max(0, wallet.energy + amount));

        const updatedWallet = await tx.wallet.update({
          where: { userId },
          data: {
            energy: newEnergy,
            lastEnergyUpdate: new Date()
          }
        });

        // 记录能量流水
        await tx.energyLedger.create({
          data: {
            userId,
            amount,
            source: this.getEnergySource(source),
            target: source
          }
        });

        logger.info(`能量更新：userId=${userId}, amount=${amount}, newEnergy=${newEnergy}`);

        return updatedWallet;
      });
    } catch (error: any) {
      logger.error('更新能量失败', { error: error.message, userId, amount });
      throw error;
    }
  }

  /**
   * 获取交易流水
   */
  async getTransactions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      currency?: Currency;
      type?: TransactionType;
    }
  ) {
    try {
      const { limit = 20, offset = 0, currency, type } = options || {};

      const where: any = { userId };
      if (currency) where.currency = currency;
      if (type) where.type = type;

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset
      });

      const total = await prisma.transaction.count({ where });

      return {
        transactions,
        total,
        hasMore: offset + limit < total
      };
    } catch (error: any) {
      logger.error('获取交易流水失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 转换能量来源字符串为枚举
   */
  private getEnergySource(source: string): any {
    const sourceMap: Record<string, any> = {
      'NATURAL_RECOVERY': 'NATURAL_RECOVERY',
      'PURCHASE': 'PURCHASE',
      'ASSIST': 'ASSIST',
      'TASK_REWARD': 'TASK_REWARD',
      'ADMIN': 'ADMIN'
    };
    return sourceMap[source] || 'ADMIN';
  }
}

export const walletService = new WalletService();

