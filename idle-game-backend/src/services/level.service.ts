import { PrismaClient, Pet } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * 经验值表配置
 * 每级所需经验值 = 基础值 * (等级 ^ 指数)
 */
class LevelService {
  private readonly BASE_EXP = 100; // 基础经验值
  private readonly EXP_EXPONENT = 1.5; // 经验增长指数
  private readonly MAX_LEVEL = 30; // 最大等级
  private readonly PRODUCTION_BONUS_PER_LEVEL = 0.05; // 每级产出加成5%

  /**
   * 计算指定等级所需的累计经验值
   */
  getRequiredExpForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level > this.MAX_LEVEL) return Infinity;

    let totalExp = 0;
    for (let i = 2; i <= level; i++) {
      totalExp += Math.floor(this.BASE_EXP * Math.pow(i, this.EXP_EXPONENT));
    }
    return totalExp;
  }

  /**
   * 计算从当前等级到下一等级所需的经验值
   */
  getExpForNextLevel(currentLevel: number): number {
    if (currentLevel >= this.MAX_LEVEL) return 0;
    return Math.floor(this.BASE_EXP * Math.pow(currentLevel + 1, this.EXP_EXPONENT));
  }

  /**
   * 获取经验值表（1-30级）
   */
  getExpTable() {
    const table = [];
    for (let level = 1; level <= this.MAX_LEVEL; level++) {
      const requiredExp = this.getRequiredExpForLevel(level);
      const nextLevelExp = this.getExpForNextLevel(level);
      table.push({
        level,
        requiredExp, // 升到该等级所需累计经验
        nextLevelExp, // 到下一级所需经验
        accumulatedExp: requiredExp,
      });
    }
    return table;
  }

  /**
   * 为星宠增加经验值
   * @param petId 星宠ID
   * @param expGain 获得的经验值
   * @returns 更新后的星宠信息和是否升级
   */
  async addExp(petId: string, expGain: number) {
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new Error('星宠不存在');
    }

    if (pet.level >= this.MAX_LEVEL) {
      logger.info(`星宠已达最大等级: ${petId}`);
      return {
        pet,
        leveledUp: false,
        levelsGained: 0,
      };
    }

    const newExp = pet.exp + expGain;
    let currentLevel = pet.level;
    let levelsGained = 0;

    // 检查是否升级（可能连续升多级）
    while (currentLevel < this.MAX_LEVEL) {
      const requiredForNextLevel = this.getRequiredExpForLevel(currentLevel + 1);
      if (newExp >= requiredForNextLevel) {
        currentLevel++;
        levelsGained++;
      } else {
        break;
      }
    }

    // 更新星宠数据
    const updatedPet = await prisma.pet.update({
      where: { id: petId },
      data: {
        exp: newExp,
        level: currentLevel,
      },
    });

    if (levelsGained > 0) {
      logger.info(`星宠升级: ${petId}, ${pet.level} -> ${currentLevel} (+${levelsGained}级)`);
    }

    return {
      pet: updatedPet,
      leveledUp: levelsGained > 0,
      levelsGained,
      expGained: expGain,
    };
  }

  /**
   * 计算星宠的等级产出加成
   * @param level 星宠等级
   * @returns 产出倍率（例如：1.5 表示 150%）
   */
  getProductionBonus(level: number): number {
    if (level <= 1) return 1.0;
    return 1.0 + (level - 1) * this.PRODUCTION_BONUS_PER_LEVEL;
  }

  /**
   * 计算挂机获得的经验值
   * @param durationMinutes 挂机时长（分钟）
   * @returns 获得的经验值
   */
  calculateAfkExp(durationMinutes: number): number {
    // 每分钟获得1点经验
    return Math.floor(durationMinutes);
  }

  /**
   * 获取星宠的经验进度信息
   * @param pet 星宠对象
   */
  getExpProgress(pet: Pet) {
    const currentLevelExp = this.getRequiredExpForLevel(pet.level);
    const nextLevelExp = this.getRequiredExpForLevel(pet.level + 1);
    const expForNextLevel = nextLevelExp - currentLevelExp;
    const currentProgress = pet.exp - currentLevelExp;
    const progressPercent = expForNextLevel > 0 
      ? (currentProgress / expForNextLevel) * 100 
      : 100;

    return {
      level: pet.level,
      currentExp: pet.exp,
      currentLevelExp,
      nextLevelExp: pet.level >= this.MAX_LEVEL ? currentLevelExp : nextLevelExp,
      expForNextLevel: pet.level >= this.MAX_LEVEL ? 0 : expForNextLevel,
      currentProgress,
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
      isMaxLevel: pet.level >= this.MAX_LEVEL,
      productionBonus: this.getProductionBonus(pet.level),
    };
  }

  /**
   * 批量增加经验值（用于任务奖励等）
   * @param petIds 星宠ID数组
   * @param expGain 每只星宠获得的经验值
   */
  async addExpBatch(petIds: string[], expGain: number) {
    const results = [];
    for (const petId of petIds) {
      try {
        const result = await this.addExp(petId, expGain);
        results.push(result);
      } catch (error) {
        logger.error(`批量增加经验失败: ${petId}`, error);
      }
    }
    return results;
  }

  /**
   * 获取用户所有星宠的平均等级
   */
  async getUserAverageLevel(userId: string): Promise<number> {
    const pets = await prisma.pet.findMany({
      where: { userId },
      select: { level: true },
    });

    if (pets.length === 0) return 0;

    const totalLevel = pets.reduce((sum, pet) => sum + pet.level, 0);
    return Math.round(totalLevel / pets.length * 10) / 10; // 保留1位小数
  }

  /**
   * 获取用户最高等级的星宠
   */
  async getUserHighestLevelPet(userId: string) {
    return prisma.pet.findFirst({
      where: { userId },
      orderBy: { level: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });
  }
}

export const levelService = new LevelService();

