import { prisma } from '../db/prisma.js';
import { TransactionType } from '@prisma/client';
import { walletService } from './wallet.service.js';
import logger from '../utils/logger.js';

/**
 * 矿点配置
 */
interface MineSpot {
  level: number;
  name: string;
  ticketCost: number;
  energyCost: number;
  duration: number; // 分钟
  baseGemReward: number;
  baseShellReward: number;
  difficulty: number; // 难度系数
}

/**
 * 矿点挑战服务
 */
class MineService {
  // 矿点配置列表
  private readonly MINE_SPOTS: MineSpot[] = [
    {
      level: 1,
      name: '初级矿洞',
      ticketCost: 1,
      energyCost: 10,
      duration: 5,
      baseGemReward: 50,
      baseShellReward: 100,
      difficulty: 1.0,
    },
    {
      level: 2,
      name: '中级矿洞',
      ticketCost: 1,
      energyCost: 20,
      duration: 10,
      baseGemReward: 120,
      baseShellReward: 250,
      difficulty: 1.5,
    },
    {
      level: 3,
      name: '高级矿洞',
      ticketCost: 2,
      energyCost: 30,
      duration: 15,
      baseGemReward: 220,
      baseShellReward: 500,
      difficulty: 2.0,
    },
    {
      level: 4,
      name: '精英矿洞',
      ticketCost: 2,
      energyCost: 40,
      duration: 20,
      baseGemReward: 350,
      baseShellReward: 800,
      difficulty: 2.5,
    },
    {
      level: 5,
      name: '传说矿洞',
      ticketCost: 3,
      energyCost: 50,
      duration: 30,
      baseGemReward: 550,
      baseShellReward: 1300,
      difficulty: 3.0,
    },
  ];

  /**
   * 获取矿点列表
   */
  getMineSpots() {
    return this.MINE_SPOTS.map(spot => ({
      ...spot,
      gemPerMinute: (spot.baseGemReward / spot.duration).toFixed(1),
      shellPerMinute: (spot.baseShellReward / spot.duration).toFixed(1),
    }));
  }

  /**
   * 根据等级获取矿点配置
   */
  private getMineSpot(level: number): MineSpot | null {
    return this.MINE_SPOTS.find(spot => spot.level === level) || null;
  }

  /**
   * 进入矿点挑战
   */
  async enterChallenge(userId: string, spotLevel: number) {
    const spot = this.getMineSpot(spotLevel);
    if (!spot) {
      throw new Error('无效的矿点等级');
    }

    // 检查是否有进行中的挑战
    const ongoingChallenge = await prisma.mineChallenge.findFirst({
      where: {
        userId,
        claimed: false,
        endTime: {
          gte: new Date(),
        },
      },
    });

    if (ongoingChallenge) {
      throw new Error('您已有进行中的挑战，请先完成或等待结算');
    }

    // 检查钱包余额
    const wallet = await walletService.getBalance(userId);

    if (wallet.mineTicket < spot.ticketCost) {
      throw new Error(`矿票不足，需要 ${spot.ticketCost} 张矿票`);
    }

    if (wallet.energy < spot.energyCost) {
      throw new Error(`能量不足，需要 ${spot.energyCost} 点能量`);
    }

    // 计算结束时间
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + spot.duration * 60 * 1000);

    // 使用事务处理
    const result = await prisma.$transaction(async (tx) => {
      // 扣除矿票和能量
      await tx.wallet.update({
        where: { userId },
        data: {
          mineTicket: {
            decrement: spot.ticketCost,
          },
          energy: {
            decrement: spot.energyCost,
          },
        },
      });

      // 记录能量消耗
      await tx.energyLedger.create({
        data: {
          userId,
          amount: -spot.energyCost,
          source: 'MINE_CHALLENGE',
          target: `矿点挑战-${spot.name}`,
        },
      });

      // 创建挑战记录
      const challenge = await tx.mineChallenge.create({
        data: {
          userId,
          spotLevel,
          ticketCost: spot.ticketCost,
          startTime,
          endTime,
        },
      });

      return challenge;
    });

    logger.info(`用户进入矿点挑战: userId=${userId}, level=${spotLevel}, challengeId=${result.id}`);

    return {
      challengeId: result.id,
      spotLevel,
      spotName: spot.name,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: spot.duration,
    };
  }

  /**
   * 计算挑战奖励
   * 基础奖励 × 难度系数 × 随机波动(0.9-1.1)
   */
  private calculateRewards(spot: MineSpot) {
    const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
    const gemReward = Math.floor(spot.baseGemReward * randomFactor);
    const shellReward = Math.floor(spot.baseShellReward * randomFactor);

    return {
      gemReward,
      shellReward,
    };
  }

  /**
   * 领取挑战奖励
   */
  async claimRewards(userId: string, challengeId: string) {
    const challenge = await prisma.mineChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error('挑战记录不存在');
    }

    if (challenge.userId !== userId) {
      throw new Error('无权领取该挑战奖励');
    }

    if (challenge.claimed) {
      throw new Error('奖励已领取');
    }

    const now = new Date();
    if (now < challenge.endTime) {
      throw new Error('挑战尚未完成，请耐心等待');
    }

    const spot = this.getMineSpot(challenge.spotLevel);
    if (!spot) {
      throw new Error('矿点配置不存在');
    }

    // 计算奖励
    const rewards = this.calculateRewards(spot);

    // 使用事务发放奖励
    await prisma.$transaction(async (tx) => {
      // 更新挑战记录
      await tx.mineChallenge.update({
        where: { id: challengeId },
        data: {
          claimed: true,
          gemReward: rewards.gemReward,
          shellReward: rewards.shellReward,
        },
      });

      // 增加宝石
      if (rewards.gemReward > 0) {
        await tx.wallet.update({
          where: { userId },
          data: {
            gemBalance: {
              increment: rewards.gemReward,
            },
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.EARN,
            amount: rewards.gemReward,
            currency: 'GEM',
            source: '矿点挑战',
            description: `${spot.name}奖励`,
          },
        });
      }

      // 增加贝壳
      if (rewards.shellReward > 0) {
        await tx.wallet.update({
          where: { userId },
          data: {
            shellBalance: {
              increment: rewards.shellReward,
            },
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.EARN,
            amount: rewards.shellReward,
            currency: 'SHELL',
            source: '矿点挑战',
            description: `${spot.name}奖励`,
          },
        });
      }
    });

    logger.info(`用户领取矿点奖励: userId=${userId}, challengeId=${challengeId}, gems=${rewards.gemReward}, shells=${rewards.shellReward}`);

    return {
      gemReward: rewards.gemReward,
      shellReward: rewards.shellReward,
      spotName: spot.name,
    };
  }

  /**
   * 获取用户当前挑战状态
   */
  async getChallengeStatus(userId: string) {
    const challenge = await prisma.mineChallenge.findFirst({
      where: {
        userId,
        claimed: false,
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    if (!challenge) {
      return {
        hasChallengeInProgress: false,
      };
    }

    const now = new Date();
    const spot = this.getMineSpot(challenge.spotLevel);
    const isCompleted = now >= challenge.endTime;
    const remainingSeconds = isCompleted ? 0 : Math.floor((challenge.endTime.getTime() - now.getTime()) / 1000);

    return {
      hasChallengeInProgress: true,
      challengeId: challenge.id,
      spotLevel: challenge.spotLevel,
      spotName: spot?.name || '未知矿点',
      startTime: challenge.startTime,
      endTime: challenge.endTime,
      isCompleted,
      remainingSeconds,
      canClaim: isCompleted,
    };
  }

  /**
   * 获取挑战历史
   */
  async getChallengeHistory(userId: string, limit: number = 20) {
    const challenges = await prisma.mineChallenge.findMany({
      where: {
        userId,
        claimed: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return challenges.map(challenge => {
      const spot = this.getMineSpot(challenge.spotLevel);
      return {
        id: challenge.id,
        spotLevel: challenge.spotLevel,
        spotName: spot?.name || '未知矿点',
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        gemReward: challenge.gemReward || 0,
        shellReward: challenge.shellReward || 0,
        claimedAt: challenge.createdAt,
      };
    });
  }

  /**
   * 自动结算超时挑战（定时任务调用）
   */
  async settleExpiredChallenges() {
    const now = new Date();
    
    // 查找所有已完成但未领取的挑战
    const expiredChallenges = await prisma.mineChallenge.findMany({
      where: {
        claimed: false,
        endTime: {
          lte: now,
        },
      },
    });

    let settledCount = 0;
    for (const challenge of expiredChallenges) {
      try {
        // 自动领取奖励
        await this.claimRewards(challenge.userId, challenge.id);
        settledCount++;
      } catch (error) {
        logger.error(`自动结算挑战失败: challengeId=${challenge.id}`, error);
      }
    }

    if (settledCount > 0) {
      logger.info(`自动结算挑战完成: ${settledCount} 个挑战`);
    }

    return settledCount;
  }
}

export const mineService = new MineService();

