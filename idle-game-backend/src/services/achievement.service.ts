import { prisma } from '../db/prisma.js';
import { TransactionType, TransactionSource } from '@prisma/client';
import { walletService } from './wallet.service.js';
import logger from '../utils/logger.js';

/**
 * 成就系统服务
 */
class AchievementService {
  // 成就配置（正常应该存在数据库中）
  private achievements = [
    {
      id: 'ACH_FUSION_1',
      name: '融合学徒',
      description: '完成首次融合',
      type: 'FUSION_COUNT',
      condition: 1,
      tier: 'BRONZE',
      rewards: { gems: 50, shells: 100 },
    },
    {
      id: 'ACH_FUSION_10',
      name: '融合大师',
      description: '完成10次融合',
      type: 'FUSION_COUNT',
      condition: 10,
      tier: 'SILVER',
      rewards: { gems: 200, shells: 500 },
    },
    {
      id: 'ACH_FUSION_50',
      name: '融合宗师',
      description: '完成50次融合',
      type: 'FUSION_COUNT',
      condition: 50,
      tier: 'GOLD',
      rewards: { gems: 500, shells: 1000 },
    },
    {
      id: 'ACH_PET_5',
      name: '收藏家',
      description: '拥有5只星宠',
      type: 'PET_COUNT',
      condition: 5,
      tier: 'BRONZE',
      rewards: { gems: 30, shells: 50 },
    },
    {
      id: 'ACH_PET_20',
      name: '大收藏家',
      description: '拥有20只星宠',
      type: 'PET_COUNT',
      condition: 20,
      tier: 'SILVER',
      rewards: { gems: 150, shells: 300 },
    },
    {
      id: 'ACH_PET_50',
      name: '传奇收藏家',
      description: '拥有50只星宠',
      type: 'PET_COUNT',
      condition: 50,
      tier: 'GOLD',
      rewards: { gems: 400, shells: 800 },
    },
    {
      id: 'ACH_RARE_1',
      name: '稀有之缘',
      description: '拥有首只稀有星宠',
      type: 'RARITY_RARE',
      condition: 1,
      tier: 'BRONZE',
      rewards: { gems: 50, shells: 0 },
    },
    {
      id: 'ACH_EPIC_1',
      name: '史诗传说',
      description: '拥有首只史诗星宠',
      type: 'RARITY_EPIC',
      condition: 1,
      tier: 'SILVER',
      rewards: { gems: 100, shells: 0 },
    },
    {
      id: 'ACH_LEGENDARY_1',
      name: '传说降临',
      description: '拥有首只传说星宠',
      type: 'RARITY_LEGENDARY',
      condition: 1,
      tier: 'GOLD',
      rewards: { gems: 200, shells: 0 },
    },
    {
      id: 'ACH_MYTHIC_1',
      name: '神话觉醒',
      description: '拥有首只神话星宠',
      type: 'RARITY_MYTHIC',
      condition: 1,
      tier: 'DIAMOND',
      rewards: { gems: 500, shells: 0 },
    },
    {
      id: 'ACH_LEVEL_10',
      name: '等级先锋',
      description: '任一星宠达到10级',
      type: 'PET_LEVEL',
      condition: 10,
      tier: 'BRONZE',
      rewards: { gems: 80, shells: 150 },
    },
    {
      id: 'ACH_LEVEL_20',
      name: '等级精英',
      description: '任一星宠达到20级',
      type: 'PET_LEVEL',
      condition: 20,
      tier: 'SILVER',
      rewards: { gems: 180, shells: 350 },
    },
    {
      id: 'ACH_LEVEL_30',
      name: '等级巅峰',
      description: '任一星宠达到30级（满级）',
      type: 'PET_LEVEL',
      condition: 30,
      tier: 'GOLD',
      rewards: { gems: 300, shells: 600 },
    },
    {
      id: 'ACH_MINE_10',
      name: '矿工学徒',
      description: '完成10次矿点挑战',
      type: 'MINE_COUNT',
      condition: 10,
      tier: 'BRONZE',
      rewards: { gems: 100, shells: 0 },
    },
    {
      id: 'ACH_MINE_50',
      name: '矿工大师',
      description: '完成50次矿点挑战',
      type: 'MINE_COUNT',
      condition: 50,
      tier: 'SILVER',
      rewards: { gems: 250, shells: 0 },
    },
    {
      id: 'ACH_FRIEND_5',
      name: '社交新星',
      description: '拥有5位好友',
      type: 'FRIEND_COUNT',
      condition: 5,
      tier: 'BRONZE',
      rewards: { gems: 60, shells: 100 },
    },
    {
      id: 'ACH_FRIEND_20',
      name: '社交达人',
      description: '拥有20位好友',
      type: 'FRIEND_COUNT',
      condition: 20,
      tier: 'SILVER',
      rewards: { gems: 180, shells: 300 },
    },
  ];

  /**
   * 获取用户成就列表
   */
  async getUserAchievements(userId: string): Promise<{
    success: boolean;
    data?: {
      unlocked: any[];
      locked: any[];
      totalCount: number;
      unlockedCount: number;
      progress: number;
    };
  }> {
    try {
      // 查询用户当前进度
      const [fusionCount, petCount, pets, mineCount, friendCount] = await Promise.all([
        prisma.fusionAttempt.count({ where: { userId } }),
        prisma.pet.count({ where: { userId } }),
        prisma.pet.findMany({
          where: { userId },
          select: { rarity: true, level: true },
        }),
        prisma.mineChallenge.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.friendship.count({ where: { userId, status: 'ACCEPTED' } }),
      ]);

      // 各稀有度数量
      const rarityCount = {
        RARE: pets.filter((p) => p.rarity === 'RARE').length,
        EPIC: pets.filter((p) => p.rarity === 'EPIC').length,
        LEGENDARY: pets.filter((p) => p.rarity === 'LEGENDARY').length,
        MYTHIC: pets.filter((p) => p.rarity === 'MYTHIC').length,
      };

      // 最高等级
      const maxLevel = pets.length > 0 ? Math.max(...pets.map((p) => p.level)) : 0;

      // 检查每个成就的解锁状态
      const achievementsWithProgress = this.achievements.map((ach) => {
        let currentValue = 0;

        switch (ach.type) {
          case 'FUSION_COUNT':
            currentValue = fusionCount;
            break;
          case 'PET_COUNT':
            currentValue = petCount;
            break;
          case 'RARITY_RARE':
            currentValue = rarityCount.RARE;
            break;
          case 'RARITY_EPIC':
            currentValue = rarityCount.EPIC;
            break;
          case 'RARITY_LEGENDARY':
            currentValue = rarityCount.LEGENDARY;
            break;
          case 'RARITY_MYTHIC':
            currentValue = rarityCount.MYTHIC;
            break;
          case 'PET_LEVEL':
            currentValue = maxLevel;
            break;
          case 'MINE_COUNT':
            currentValue = mineCount;
            break;
          case 'FRIEND_COUNT':
            currentValue = friendCount;
            break;
        }

        const unlocked = currentValue >= ach.condition;
        const progress = Math.min(100, (currentValue / ach.condition) * 100);

        return {
          ...ach,
          currentValue,
          unlocked,
          progress,
        };
      });

      const unlocked = achievementsWithProgress.filter((a) => a.unlocked);
      const locked = achievementsWithProgress.filter((a) => !a.unlocked);

      return {
        success: true,
        data: {
          unlocked,
          locked,
          totalCount: this.achievements.length,
          unlockedCount: unlocked.length,
          progress: Math.floor((unlocked.length / this.achievements.length) * 100),
        },
      };
    } catch (error: any) {
      logger.error('获取成就列表失败', { error: error.message, userId });
      return { success: false };
    }
  }

  /**
   * 领取成就奖励
   * 注意：这里简化为实时检查+领取，实际可能需要一个UserAchievement表来记录领取状态
   */
  async claimAchievement(userId: string, achievementId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      gems: number;
      shells: number;
    };
  }> {
    try {
      // 查找成就
      const achievement = this.achievements.find((a) => a.id === achievementId);
      if (!achievement) {
        return { success: false, message: '成就不存在' };
      }

      // 检查是否已解锁（这里简化，正常需要查表）
      const achievements = await this.getUserAchievements(userId);
      if (!achievements.success || !achievements.data) {
        return { success: false, message: '查询成就失败' };
      }

      const unlockedAch = achievements.data.unlocked.find((a) => a.id === achievementId);
      if (!unlockedAch) {
        return { success: false, message: '成就尚未解锁' };
      }

      // 发放奖励（事务）
      await prisma.$transaction(async (tx) => {
        if (achievement.rewards.gems > 0) {
          await walletService.updateGems(
            userId,
            achievement.rewards.gems,
            TransactionType.EARN,
            TransactionSource.ACHIEVEMENT,
            `成就奖励：${achievement.name}`,
            tx
          );
        }

        if (achievement.rewards.shells > 0) {
          await walletService.updateShells(
            userId,
            achievement.rewards.shells,
            TransactionType.EARN,
            TransactionSource.ACHIEVEMENT,
            `成就奖励：${achievement.name}`,
            tx
          );
        }
      });

      logger.info(`成就奖励领取：userId=${userId}, achievementId=${achievementId}`);

      return {
        success: true,
        message: '奖励领取成功',
        data: {
          gems: achievement.rewards.gems,
          shells: achievement.rewards.shells,
        },
      };
    } catch (error: any) {
      logger.error('领取成就奖励失败', { error: error.message, userId, achievementId });
      return { success: false, message: '领取失败，请稍后重试' };
    }
  }
}

export const achievementService = new AchievementService();

