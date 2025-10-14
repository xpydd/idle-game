import { prisma } from '../db/prisma.js';
import logger from '../utils/logger.js';

/**
 * 用户服务
 */
class UserService {
  /**
   * 获取用户完整信息
   * 包含基本信息、资产信息、认证状态等
   */
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          wallet: true,
          pets: {
            orderBy: [
              { rarity: 'desc' },
              { level: 'desc' }
            ]
          }
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 构建返回数据，排除敏感信息
      return {
        userId: user.id,
        phone: user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), // 手机号脱敏
        nickname: user.realName ? user.realName.charAt(0) + '***' : '未设置',
        kycStatus: user.kycStatus,
        isKycVerified: user.kycStatus === 'VERIFIED',
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        wallet: user.wallet ? {
          gemBalance: user.wallet.gemBalance,
          shellBalance: user.wallet.shellBalance,
          energy: user.wallet.energy,
          lastEnergyUpdate: user.wallet.lastEnergyUpdate
        } : null,
        petCount: user.pets.length,
        pets: user.pets.slice(0, 5) // 只返回前5只星宠
      };
    } catch (error: any) {
      logger.error('获取用户信息失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  async updateUserProfile(userId: string, data: {
    nickname?: string;
    avatar?: string;
  }) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 更新允许的字段（目前仅支持 nickname）
      const updateData: any = {};
      if (typeof data.nickname === 'string' && data.nickname.trim().length > 0) {
        updateData.nickname = data.nickname.trim().slice(0, 20);
      }
      // avatar 字段暂未在schema中定义，如需启用请在schema中添加

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: updateData
        });
      }

      logger.info(`用户信息更新：userId=${userId}`);

      return {
        success: true,
        message: '更新成功'
      };
    } catch (error: any) {
      logger.error('更新用户信息失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(userId: string) {
    try {
      // 查询用户的各项统计数据
      const [petCount, totalProduction, totalTransactions] = await Promise.all([
        // 星宠数量
        prisma.pet.count({
          where: { userId }
        }),
        // 总产出
        prisma.productionLog.aggregate({
          where: { userId },
          _sum: {
            gemProduced: true,
            shellProduced: true
          }
        }),
        // 交易次数
        prisma.transaction.count({
          where: { userId }
        })
      ]);

      return {
        petCount,
        totalGemProduced: totalProduction._sum.gemProduced || 0,
        totalShellProduced: totalProduction._sum.shellProduced || 0,
        totalTransactions
      };
    } catch (error: any) {
      logger.error('获取用户统计失败', { error: error.message, userId });
      throw error;
    }
  }
}

export const userService = new UserService();

