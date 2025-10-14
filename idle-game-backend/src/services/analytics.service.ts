import { prisma } from '../db/prisma.js';
import logger from '../utils/logger.js';

/**
 * 数据分析服务
 */
class AnalyticsService {
  /**
   * 获取用户统计数据
   */
  async getUserStats(startDate?: Date, endDate?: Date): Promise<{
    totalUsers: number;
    newUsersToday: number;
    verifiedUsers: number;
    verificationRate: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalUsers, newUsersToday, verifiedUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            createdAt: {
              gte: today,
            },
          },
        }),
        prisma.user.count({
          where: {
            kycStatus: 'VERIFIED',
          },
        }),
      ]);

      return {
        totalUsers,
        newUsersToday,
        verifiedUsers,
        verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0,
      };
    } catch (error: any) {
      logger.error('获取用户统计失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取经济统计数据
   */
  async getEconomyStats(startDate?: Date, endDate?: Date): Promise<{
    totalGemsEarned: number;
    totalGemsSpent: number;
    totalShellsEarned: number;
    totalShellsSpent: number;
    gemsBalance: number;
    shellsBalance: number;
  }> {
    try {
      const [earnTransactions, spendTransactions, wallets] = await Promise.all([
        prisma.transaction.groupBy({
          by: ['currency'],
          where: {
            type: 'EARN',
            ...(startDate && endDate
              ? { createdAt: { gte: startDate, lte: endDate } }
              : {}),
          },
          _sum: {
            amount: true,
          },
        }),
        prisma.transaction.groupBy({
          by: ['currency'],
          where: {
            type: 'SPEND',
            ...(startDate && endDate
              ? { createdAt: { gte: startDate, lte: endDate } }
              : {}),
          },
          _sum: {
            amount: true,
          },
        }),
        prisma.wallet.aggregate({
          _sum: {
            gemBalance: true,
            shellBalance: true,
          },
        }),
      ]);

      const gemsEarned =
        earnTransactions.find((t) => t.currency === 'GEM')?._sum.amount || 0;
      const shellsEarned =
        earnTransactions.find((t) => t.currency === 'SHELL')?._sum.amount || 0;
      const gemsSpent =
        spendTransactions.find((t) => t.currency === 'GEM')?._sum.amount || 0;
      const shellsSpent =
        spendTransactions.find((t) => t.currency === 'SHELL')?._sum.amount || 0;

      return {
        totalGemsEarned: gemsEarned,
        totalGemsSpent: gemsSpent,
        totalShellsEarned: shellsEarned,
        totalShellsSpent: shellsSpent,
        gemsBalance: wallets._sum.gemBalance || 0,
        shellsBalance: wallets._sum.shellBalance || 0,
      };
    } catch (error: any) {
      logger.error('获取经济统计失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取游戏数据统计
   */
  async getGameStats(): Promise<{
    totalPets: number;
    totalFusions: number;
    totalMineChallenges: number;
    totalTasks: number;
    rarityDistribution: {
      rarity: string;
      count: number;
    }[];
  }> {
    try {
      const [totalPets, totalFusions, totalMineChallenges, totalTasks, rarityDistribution] =
        await Promise.all([
          prisma.pet.count(),
          prisma.fusionAttempt.count(),
          prisma.mineChallenge.count(),
          prisma.userTask.count(),
          prisma.pet.groupBy({
            by: ['rarity'],
            _count: {
              rarity: true,
            },
          }),
        ]);

      return {
        totalPets,
        totalFusions,
        totalMineChallenges,
        totalTasks,
        rarityDistribution: rarityDistribution.map((r) => ({
          rarity: r.rarity,
          count: r._count.rarity,
        })),
      };
    } catch (error: any) {
      logger.error('获取游戏统计失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取社交统计数据
   */
  async getSocialStats(): Promise<{
    totalFriendships: number;
    totalInvitations: number;
    totalAssists: number;
    averageFriendsPerUser: number;
  }> {
    try {
      const [totalFriendships, totalInvitations, totalAssists, userCount] = await Promise.all([
        prisma.friendship.count({
          where: {
            status: 'ACCEPTED',
          },
        }),
        prisma.invitation.count(),
        prisma.assistLog.count(),
        prisma.user.count(),
      ]);

      return {
        totalFriendships,
        totalInvitations,
        totalAssists,
        averageFriendsPerUser: userCount > 0 ? totalFriendships / userCount : 0,
      };
    } catch (error: any) {
      logger.error('获取社交统计失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取综合统计数据
   */
  async getOverallStats(): Promise<{
    user: Awaited<ReturnType<typeof this.getUserStats>>;
    economy: Awaited<ReturnType<typeof this.getEconomyStats>>;
    game: Awaited<ReturnType<typeof this.getGameStats>>;
    social: Awaited<ReturnType<typeof this.getSocialStats>>;
  }> {
    try {
      const [user, economy, game, social] = await Promise.all([
        this.getUserStats(),
        this.getEconomyStats(),
        this.getGameStats(),
        this.getSocialStats(),
      ]);

      return {
        user,
        economy,
        game,
        social,
      };
    } catch (error: any) {
      logger.error('获取综合统计失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取活跃用户统计（DAU/MAU）
   */
  async getActiveUserStats(): Promise<{
    dau: number;
    wau: number;
    mau: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      // 注意：这里使用 lastLoginAt 字段，但该字段在schema中可能不存在
      // 实际应用中需要添加该字段或使用其他活跃度指标
      // 这里使用 updatedAt 作为替代
      const [dau, wau, mau] = await Promise.all([
        prisma.user.count({
          where: {
            updatedAt: {
              gte: today,
            },
          },
        }),
        prisma.user.count({
          where: {
            updatedAt: {
              gte: weekAgo,
            },
          },
        }),
        prisma.user.count({
          where: {
            updatedAt: {
              gte: monthAgo,
            },
          },
        }),
      ]);

      return {
        dau,
        wau,
        mau,
      };
    } catch (error: any) {
      logger.error('获取活跃用户统计失败', { error: error.message });
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();

