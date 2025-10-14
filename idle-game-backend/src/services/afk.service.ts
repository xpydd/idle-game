import { prisma } from '../db/prisma.js';
import { TransactionType } from '@prisma/client';
import { walletService } from './wallet.service.js';
import { petService } from './pet.service.js';
import { levelService } from './level.service.js';
import logger from '../utils/logger.js';

/**
 * 挂机系统服务
 */
class AFKService {
  // 能量消耗速率：每小时20点
  private readonly ENERGY_COST_PER_HOUR = 20;
  
  // 能量自然恢复速率：每小时10点
  private readonly ENERGY_RECOVERY_PER_HOUR = 10;
  
  // 能量上限
  private readonly MAX_ENERGY = 100;
  
  // 离线收益系数
  private readonly OFFLINE_RATE = 0.8;
  
  // 离线收益最大时长（小时）
  private readonly MAX_OFFLINE_HOURS = 12;

  /**
   * 能量自然恢复
   * 定时任务每小时调用一次
   */
  async recoverEnergyForAllUsers() {
    try {
      logger.info('开始能量恢复定时任务');
      
      // 查询所有需要恢复能量的用户（能量<100的）
      const wallets = await prisma.wallet.findMany({
        where: {
          energy: {
            lt: this.MAX_ENERGY
          }
        }
      });

      let recoveredCount = 0;
      for (const wallet of wallets) {
        const newEnergy = Math.min(
          this.MAX_ENERGY,
          wallet.energy + this.ENERGY_RECOVERY_PER_HOUR
        );

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            energy: newEnergy,
            lastEnergyUpdate: new Date()
          }
        });

        // 记录能量流水
        await prisma.energyLedger.create({
          data: {
            userId: wallet.userId,
            amount: this.ENERGY_RECOVERY_PER_HOUR,
            source: 'NATURAL_RECOVERY',
            target: '自然恢复'
          }
        });

        recoveredCount++;
      }

      logger.info(`能量恢复完成，恢复用户数：${recoveredCount}`);
      return recoveredCount;
    } catch (error: any) {
      logger.error('能量恢复失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 计算星宠产出速率
   * 基础公式：r_base × (1 + level × 0.05) × rarity_multiplier
   */
  calculateProductionRate(pet: any): {
    gemPerHour: number;
    shellPerHour: number;
  } {
    return petService.calculateProductionRate(pet);
  }

  /**
   * 计算挂机收益
   * @param userId 用户ID
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param isOnline 是否在线
   */
  async calculateRewards(
    userId: string,
    startTime: Date,
    endTime: Date,
    isOnline: boolean = true
  ): Promise<{
    gems: number;
    shells: number;
    hours: number;
    energyConsumed: number;
  }> {
    try {
      // 获取用户的星宠
      const pets = await prisma.pet.findMany({
        where: { userId }
      });

      if (pets.length === 0) {
        return { gems: 0, shells: 0, hours: 0, energyConsumed: 0 };
      }

      // 计算时长（小时）
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      let hours = duration;

      // 离线时长限制
      if (!isOnline) {
        hours = Math.min(hours, this.MAX_OFFLINE_HOURS);
      }

      // 计算能量消耗
      const energyConsumed = Math.floor(hours * this.ENERGY_COST_PER_HOUR);

      // 计算总产出速率（所有星宠的总和）
      let totalGemRate = 0;
      let totalShellRate = 0;

      for (const pet of pets) {
        const rate = this.calculateProductionRate(pet);
        totalGemRate += rate.gemPerHour;
        totalShellRate += rate.shellPerHour;
      }

      // 计算总产出
      let gems = totalGemRate * hours;
      let shells = totalShellRate * hours;

      // 离线收益打折
      if (!isOnline) {
        gems *= this.OFFLINE_RATE;
        shells *= this.OFFLINE_RATE;
      }

      // 动态衰减系数（预留，暂时设为1）
      const decayFactor = 1;
      gems *= decayFactor;
      shells *= decayFactor;

      return {
        gems: Math.round(gems * 100) / 100,
        shells: Math.round(shells * 100) / 100,
        hours: Math.round(hours * 100) / 100,
        energyConsumed
      };
    } catch (error: any) {
      logger.error('计算挂机收益失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 开启挂机
   */
  async startAFK(userId: string, autoRefill: boolean = false): Promise<{
    success: boolean;
    message: string;
    startTime?: Date;
  }> {
    try {
      // 检查用户是否有星宠
      const pets = await prisma.pet.findMany({
        where: { userId },
        take: 1
      });

      if (pets.length === 0) {
        return {
          success: false,
          message: '您还没有星宠，请先完成实名认证领取新手星宠'
        };
      }

      // 检查是否已经在挂机中
      const existingLog = await prisma.productionLog.findFirst({
        where: {
          userId,
          endTime: {
            gte: new Date()
          }
        },
        orderBy: {
          startTime: 'desc'
        }
      });

      if (existingLog) {
        return {
          success: true,
          message: '挂机已在进行中',
          startTime: existingLog.startTime
        };
      }

      // 检查能量是否充足
      const wallet = await walletService.getBalance(userId);
      if (wallet.energy < this.ENERGY_COST_PER_HOUR) {
        return {
          success: false,
          message: '能量不足，无法开启挂机'
        };
      }

      // 创建挂机记录（设置一个未来的结束时间，实际领取时会更新）
      const startTime = new Date();
      const estimatedEndTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 预估24小时

      await prisma.productionLog.create({
        data: {
          userId,
          petId: pets[0].id, // 使用第一只星宠
          startTime,
          endTime: estimatedEndTime,
          isOnline: true,
          gemProduced: 0,
          shellProduced: 0,
          energyConsumed: 0
        }
      });

      logger.info(`用户开启挂机：userId=${userId}, startTime=${startTime}`);

      return {
        success: true,
        message: '挂机已开启',
        startTime
      };
    } catch (error: any) {
      logger.error('开启挂机失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 领取挂机收益
   */
  async claimRewards(userId: string): Promise<{
    success: boolean;
    message: string;
    rewards?: {
      gems: number;
      shells: number;
      hours: number;
    };
  }> {
    try {
      // 查询当前挂机记录
      const log = await prisma.productionLog.findFirst({
        where: {
          userId,
          endTime: {
            gte: new Date()
          }
        },
        orderBy: {
          startTime: 'desc'
        }
      });

      if (!log) {
        return {
          success: false,
          message: '当前没有进行中的挂机'
        };
      }

      // 计算收益
      const now = new Date();
      const rewards = await this.calculateRewards(userId, log.startTime, now, true);

      // 检查能量是否足够
      const wallet = await walletService.getBalance(userId);
      if (wallet.energy < rewards.energyConsumed) {
        // 能量不足，按实际能量计算收益
        const actualHours = wallet.energy / this.ENERGY_COST_PER_HOUR;
        const adjustedRewards = await this.calculateRewards(
          userId,
          log.startTime,
          new Date(log.startTime.getTime() + actualHours * 60 * 60 * 1000),
          true
        );
        rewards.gems = adjustedRewards.gems;
        rewards.shells = adjustedRewards.shells;
        rewards.hours = adjustedRewards.hours;
        rewards.energyConsumed = wallet.energy;
      }

      // 使用事务处理
      await prisma.$transaction(async (tx) => {
        // 更新挂机记录
        await tx.productionLog.update({
          where: { id: log.id },
          data: {
            endTime: now,
            gemProduced: rewards.gems,
            shellProduced: rewards.shells,
            energyConsumed: rewards.energyConsumed
          }
        });

        // 增加宝石
        if (rewards.gems > 0) {
          await tx.wallet.update({
            where: { userId },
            data: {
              gemBalance: {
                increment: rewards.gems
              }
            }
          });

          await tx.transaction.create({
            data: {
              userId,
              type: TransactionType.EARN,
              amount: rewards.gems,
              currency: 'GEM',
              source: '挂机产出',
              description: `挂机${rewards.hours.toFixed(2)}小时`
            }
          });
        }

        // 增加贝壳
        if (rewards.shells > 0) {
          await tx.wallet.update({
            where: { userId },
            data: {
              shellBalance: {
                increment: rewards.shells
              }
            }
          });

          await tx.transaction.create({
            data: {
              userId,
              type: TransactionType.EARN,
              amount: rewards.shells,
              currency: 'SHELL',
              source: '挂机产出',
              description: `挂机${rewards.hours.toFixed(2)}小时`
            }
          });
        }

        // 消耗能量
        await tx.wallet.update({
          where: { userId },
          data: {
            energy: {
              decrement: rewards.energyConsumed
            },
            lastEnergyUpdate: now
          }
        });

        await tx.energyLedger.create({
          data: {
            userId,
            amount: -rewards.energyConsumed,
            source: 'NATURAL_RECOVERY',
            target: '挂机消耗'
          }
        });
      });

      // 为挂机的星宠增加经验值（每分钟1点经验）
      let levelUpInfo = null;
      if (log.petId) {
        try {
          const expGain = levelService.calculateAfkExp(rewards.hours * 60);
          const result = await levelService.addExp(log.petId, expGain);
          if (result.leveledUp) {
            levelUpInfo = {
              petName: result.pet.name || '未命名星宠',
              oldLevel: result.pet.level - result.levelsGained,
              newLevel: result.pet.level,
              levelsGained: result.levelsGained,
            };
            logger.info(`星宠升级：petId=${log.petId}, ${levelUpInfo.oldLevel} -> ${levelUpInfo.newLevel}`);
          }
        } catch (error: any) {
          logger.error('星宠经验值增加失败', { error: error.message, petId: log.petId });
        }
      }

      logger.info(`用户领取挂机收益：userId=${userId}, gems=${rewards.gems}, shells=${rewards.shells}`);

      return {
        success: true,
        message: '收益领取成功',
        rewards: {
          gems: rewards.gems,
          shells: rewards.shells,
          hours: rewards.hours
        },
        levelUp: levelUpInfo
      };
    } catch (error: any) {
      logger.error('领取挂机收益失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 查询挂机状态
   */
  async getAFKStatus(userId: string): Promise<{
    isAfking: boolean;
    startTime?: Date;
    currentRewards?: {
      gems: number;
      shells: number;
      hours: number;
    };
    energy: number;
    estimatedStopTime?: Date;
  }> {
    try {
      const wallet = await walletService.getBalance(userId);

      // 查询当前挂机记录
      const log = await prisma.productionLog.findFirst({
        where: {
          userId,
          endTime: {
            gte: new Date()
          }
        },
        orderBy: {
          startTime: 'desc'
        }
      });

      if (!log) {
        return {
          isAfking: false,
          energy: wallet.energy
        };
      }

      // 计算当前收益
      const now = new Date();
      const rewards = await this.calculateRewards(userId, log.startTime, now, true);

      // 计算预计停止时间（能量耗尽时）
      const remainingHours = wallet.energy / this.ENERGY_COST_PER_HOUR;
      const estimatedStopTime = new Date(now.getTime() + remainingHours * 60 * 60 * 1000);

      return {
        isAfking: true,
        startTime: log.startTime,
        currentRewards: {
          gems: rewards.gems,
          shells: rewards.shells,
          hours: rewards.hours
        },
        energy: wallet.energy,
        estimatedStopTime
      };
    } catch (error: any) {
      logger.error('查询挂机状态失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 计算离线收益
   * 用户登录时调用
   */
  async calculateOfflineRewards(userId: string, lastLoginTime: Date): Promise<{
    gems: number;
    shells: number;
    hours: number;
  }> {
    try {
      const now = new Date();
      const rewards = await this.calculateRewards(userId, lastLoginTime, now, false);

      return {
        gems: rewards.gems,
        shells: rewards.shells,
        hours: rewards.hours
      };
    } catch (error: any) {
      logger.error('计算离线收益失败', { error: error.message, userId });
      throw error;
    }
  }
}

export const afkService = new AFKService();

