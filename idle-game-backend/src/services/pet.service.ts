import { prisma } from '../db/prisma.js';
import { PetRarity, KYCStatus } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * 星宠服务
 */
class PetService {
  /**
   * 新手星宠名称列表
   */
  private readonly NEWBIE_PET_NAMES = [
    '星尘', '月影', '晨曦', '暮光', '流星',
    '星辰', '银河', '极光', '星河', '星云'
  ];

  /**
   * 随机获取新手星宠名称
   */
  private getRandomNewbiePetName(): string {
    const index = Math.floor(Math.random() * this.NEWBIE_PET_NAMES.length);
    return this.NEWBIE_PET_NAMES[index];
  }

  /**
   * 发放新手星宠
   * 实名认证成功后自动调用
   */
  async grantNewbiePet(userId: string): Promise<{
    success: boolean;
    message: string;
    pet?: any;
  }> {
    try {
      // 检查用户是否存在且已认证
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          kycStatus: true,
          pets: true,
          wallet: true
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查是否已完成实名认证
      if (user.kycStatus !== KYCStatus.VERIFIED) {
        return {
          success: false,
          message: '请先完成实名认证'
        };
      }

      // 检查是否已领取新手星宠（已有任何星宠即视为已领取）
      if (user.pets && user.pets.length > 0) {
        return {
          success: false,
          message: '您已领取过新手星宠'
        };
      }

      // 创建新手星宠（普通稀有度）
      const petName = this.getRandomNewbiePetName();
      const newPet = await prisma.pet.create({
        data: {
          userId,
          rarity: PetRarity.COMMON,
          level: 1,
          exp: 0,
          name: petName,
          bondTag: '新手'
        }
      });

      // 如果用户还没有钱包，创建钱包
      if (!user.wallet) {
        await prisma.wallet.create({
          data: {
            userId,
            gemBalance: 0,
            shellBalance: 100, // 新手赠送100贝壳
            energy: 100
          }
        });
      }

      logger.info(`新手星宠发放成功：userId=${userId}, petId=${newPet.id}, name=${petName}`);

      return {
        success: true,
        message: `恭喜获得新手星宠：${petName}！`,
        pet: newPet
      };
    } catch (error: any) {
      logger.error('新手星宠发放失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 查询用户的所有星宠（支持筛选和排序）
   */
  async getUserPets(
    userId: string,
    options?: {
      rarity?: PetRarity;
      sortBy?: 'rarity' | 'level' | 'exp' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    }
  ): Promise<{
    pets: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      rarity,
      sortBy = 'rarity',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = options || {};

    // 构建查询条件
    const where: any = { userId };
    if (rarity) {
      where.rarity = rarity;
    }

    // 计算总数
    const total = await prisma.pet.count({ where });

    // 查询星宠列表
    const pets = await prisma.pet.findMany({
      where,
      orderBy: [
        { [sortBy]: sortOrder },
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: limit
    });

    // 为每个星宠添加产出速率
    const petsWithStats = pets.map(pet => ({
      ...pet,
      production: this.calculateProductionRate(pet)
    }));

    return {
      pets: petsWithStats,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 查询单个星宠详情（包含统计信息）
   */
  async getPetById(petId: string, userId: string): Promise<any> {
    const pet = await prisma.pet.findFirst({
      where: {
        id: petId,
        userId // 确保只能查询自己的星宠
      }
    });

    if (!pet) {
      throw new Error('星宠不存在');
    }

    // 计算产出速率
    const production = this.calculateProductionRate(pet);

    // 查询历史产出统计
    const productionLogs = await prisma.productionLog.aggregate({
      where: { petId },
      _sum: {
        gemAmount: true,
        shellAmount: true
      }
    });

    // 计算升级所需经验
    const nextLevelExp = this.calculateExpForLevel(pet.level + 1);
    const currentLevelExp = this.calculateExpForLevel(pet.level);
    const expToNext = nextLevelExp - pet.exp;
    const expProgress = pet.exp - currentLevelExp;
    const expProgressPercent = (expProgress / (nextLevelExp - currentLevelExp)) * 100;

    return {
      ...pet,
      production,
      stats: {
        totalGemProduced: productionLogs._sum.gemAmount || 0,
        totalShellProduced: productionLogs._sum.shellAmount || 0,
        nextLevelExp,
        expToNext,
        expProgress: Math.round(expProgressPercent * 100) / 100
      }
    };
  }

  /**
   * 计算指定等级所需的总经验值
   */
  private calculateExpForLevel(level: number): number {
    // 经验公式：level^2 * 100
    return level * level * 100;
  }

  /**
   * 获取用户星宠统计
   */
  async getPetStats(userId: string): Promise<{
    totalPets: number;
    rarityDistribution: Record<PetRarity, number>;
    averageLevel: number;
    totalProduction: {
      gems: number;
      shells: number;
    };
  }> {
    const pets = await prisma.pet.findMany({
      where: { userId },
      select: {
        rarity: true,
        level: true,
        id: true
      }
    });

    // 稀有度分布
    const rarityDistribution: Record<PetRarity, number> = {
      [PetRarity.COMMON]: 0,
      [PetRarity.RARE]: 0,
      [PetRarity.EPIC]: 0,
      [PetRarity.LEGENDARY]: 0,
      [PetRarity.MYTHIC]: 0
    };

    pets.forEach(pet => {
      rarityDistribution[pet.rarity as PetRarity]++;
    });

    // 平均等级
    const averageLevel = pets.length > 0
      ? pets.reduce((sum, pet) => sum + pet.level, 0) / pets.length
      : 0;

    // 历史总产出
    const productionStats = await prisma.productionLog.aggregate({
      where: {
        petId: {
          in: pets.map(p => p.id)
        }
      },
      _sum: {
        gemAmount: true,
        shellAmount: true
      }
    });

    return {
      totalPets: pets.length,
      rarityDistribution,
      averageLevel: Math.round(averageLevel * 100) / 100,
      totalProduction: {
        gems: productionStats._sum.gemAmount || 0,
        shells: productionStats._sum.shellAmount || 0
      }
    };
  }

  /**
   * 计算星宠产出速率
   * 基础公式：r_base × (1 + level × 0.05) × rarity_multiplier
   */
  calculateProductionRate(pet: any): {
    gemPerHour: number;
    shellPerHour: number;
  } {
    // 基础产出速率（每小时）
    const BASE_GEM_RATE = 10;
    const BASE_SHELL_RATE = 25;

    // 稀有度倍率
    const rarityMultiplier: Record<PetRarity, number> = {
      [PetRarity.COMMON]: 1.0,
      [PetRarity.RARE]: 1.5,
      [PetRarity.EPIC]: 2.0,
      [PetRarity.LEGENDARY]: 3.0,
      [PetRarity.MYTHIC]: 5.0
    };

    // 等级加成（每级+5%）
    const levelBonus = pet.level * 0.05;

    // 稀有度倍率
    const rarityBonus = rarityMultiplier[pet.rarity as PetRarity] || 1.0;

    // 最终产出速率
    const gemPerHour = BASE_GEM_RATE * (1 + levelBonus) * rarityBonus;
    const shellPerHour = BASE_SHELL_RATE * (1 + levelBonus) * rarityBonus;

    return {
      gemPerHour: Math.round(gemPerHour * 100) / 100,
      shellPerHour: Math.round(shellPerHour * 100) / 100
    };
  }
}

export const petService = new PetService();

