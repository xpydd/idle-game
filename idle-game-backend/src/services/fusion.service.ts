import { prisma } from '../db/prisma.js';
import { PetRarity } from '@prisma/client';
import { walletService } from './wallet.service.js';
import logger from '../utils/logger.js';

/**
 * 融合规则配置
 */
interface FusionRule {
  targetRarity: PetRarity;
  requiredMaterials: {
    rarity: PetRarity;
    count: number;
  }[];
  shellCost: number;
  baseSuccessRate: number; // 基础成功率
}

/**
 * 融合服务
 */
class FusionService {
  /**
   * 融合规则表
   */
  private readonly FUSION_RULES: FusionRule[] = [
    // 合成稀有（RARE）
    {
      targetRarity: PetRarity.RARE,
      requiredMaterials: [
        { rarity: PetRarity.COMMON, count: 3 }
      ],
      shellCost: 200,
      baseSuccessRate: 0.70 // 70%
    },
    // 合成史诗（EPIC）
    {
      targetRarity: PetRarity.EPIC,
      requiredMaterials: [
        { rarity: PetRarity.RARE, count: 3 }
      ],
      shellCost: 500,
      baseSuccessRate: 0.50 // 50%
    },
    // 合成传说（LEGENDARY）
    {
      targetRarity: PetRarity.LEGENDARY,
      requiredMaterials: [
        { rarity: PetRarity.EPIC, count: 3 }
      ],
      shellCost: 1000,
      baseSuccessRate: 0.30 // 30%
    },
    // 合成神话（MYTHIC）
    {
      targetRarity: PetRarity.MYTHIC,
      requiredMaterials: [
        { rarity: PetRarity.LEGENDARY, count: 3 }
      ],
      shellCost: 2000,
      baseSuccessRate: 0.20 // 20%
    }
  ];

  /**
   * 稀有度名称映射
   */
  private readonly RARITY_NAMES: Record<PetRarity, string> = {
    [PetRarity.COMMON]: '普通',
    [PetRarity.RARE]: '稀有',
    [PetRarity.EPIC]: '史诗',
    [PetRarity.LEGENDARY]: '传说',
    [PetRarity.MYTHIC]: '神话'
  };

  /**
   * 获取融合规则列表
   */
  getFusionRules(): FusionRule[] {
    return this.FUSION_RULES.map(rule => ({
      ...rule,
      targetRarityName: this.RARITY_NAMES[rule.targetRarity]
    })) as any;
  }

  /**
   * 获取指定目标稀有度的融合规则
   */
  private getFusionRule(targetRarity: PetRarity): FusionRule | null {
    return this.FUSION_RULES.find(rule => rule.targetRarity === targetRarity) || null;
  }

  /**
   * 验证材料是否满足要求
   */
  async validateMaterials(
    userId: string,
    materialPetIds: string[],
    targetRarity: PetRarity
  ): Promise<{
    valid: boolean;
    message?: string;
    pets?: any[];
  }> {
    try {
      // 获取融合规则
      const rule = this.getFusionRule(targetRarity);
      if (!rule) {
        return {
          valid: false,
          message: '无效的目标稀有度'
        };
      }

      // 查询材料星宠
      const pets = await prisma.pet.findMany({
        where: {
          id: {
            in: materialPetIds
          },
          userId // 确保是用户自己的星宠
        }
      });

      // 检查数量
      const totalRequired = rule.requiredMaterials.reduce((sum, req) => sum + req.count, 0);
      if (pets.length !== totalRequired) {
        return {
          valid: false,
          message: `需要${totalRequired}只星宠作为材料，当前选择了${pets.length}只`
        };
      }

      // 检查稀有度分布
      const rarityCount: Record<PetRarity, number> = {
        [PetRarity.COMMON]: 0,
        [PetRarity.RARE]: 0,
        [PetRarity.EPIC]: 0,
        [PetRarity.LEGENDARY]: 0,
        [PetRarity.MYTHIC]: 0
      };

      pets.forEach(pet => {
        rarityCount[pet.rarity as PetRarity]++;
      });

      // 验证每个稀有度要求
      for (const requirement of rule.requiredMaterials) {
        if (rarityCount[requirement.rarity] !== requirement.count) {
          return {
            valid: false,
            message: `需要${requirement.count}只${this.RARITY_NAMES[requirement.rarity]}星宠，当前只有${rarityCount[requirement.rarity]}只`
          };
        }
      }

      return {
        valid: true,
        pets
      };
    } catch (error: any) {
      logger.error('验证材料失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 执行融合
   */
  async attemptFusion(
    userId: string,
    materialPetIds: string[],
    targetRarity: PetRarity,
    useProtection: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    result?: {
      newPet?: any;
      fusionAttemptId: string;
    };
  }> {
    try {
      // 获取融合规则
      const rule = this.getFusionRule(targetRarity);
      if (!rule) {
        return {
          success: false,
          message: '无效的目标稀有度'
        };
      }

      // 验证材料
      const validation = await this.validateMaterials(userId, materialPetIds, targetRarity);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message!
        };
      }

      // 检查贝壳余额
      const wallet = await walletService.getBalance(userId);
      if (wallet.shellBalance < rule.shellCost) {
        return {
          success: false,
          message: `贝壳不足，需要${rule.shellCost}贝壳`
        };
      }

      // 计算成功率
      let successRate = rule.baseSuccessRate;
      if (useProtection) {
        successRate = 1.0; // 使用保护符保底100%
      }

      // 随机判定是否成功
      const fusionSuccess = Math.random() < successRate;

      // 使用事务执行融合
      const result = await prisma.$transaction(async (tx) => {
        // 扣除贝壳手续费
        await walletService.updateShells(
          userId,
          -rule.shellCost,
          'SPEND',
          '融合手续费',
          `融合${this.RARITY_NAMES[targetRarity]}星宠`
        );

        let newPet = null;

        if (fusionSuccess) {
          // 融合成功：创建新星宠
          newPet = await tx.pet.create({
            data: {
              userId,
              rarity: targetRarity,
              level: 1,
              exp: 0,
              name: this.generatePetName(targetRarity),
              bondTag: '融合'
            }
          });
        }

        // 创建融合记录
        const fusionAttempt = await tx.fusionAttempt.create({
          data: {
            userId,
            targetRarity,
            shellCost: rule.shellCost,
            useProtection,
            success: fusionSuccess,
            resultPetId: newPet?.id
          }
        });

        // 记录材料
        for (const pet of validation.pets!) {
          await tx.fusionMaterial.create({
            data: {
              fusionAttemptId: fusionAttempt.id,
              petId: pet.id,
              petRarity: pet.rarity,
              petLevel: pet.level
            }
          });
        }

        // 删除材料星宠
        await tx.pet.deleteMany({
          where: {
            id: {
              in: materialPetIds
            }
          }
        });

        return {
          fusionAttemptId: fusionAttempt.id,
          newPet
        };
      });

      const message = fusionSuccess
        ? `融合成功！获得${this.RARITY_NAMES[targetRarity]}星宠：${result.newPet!.name}`
        : `融合失败...材料已消耗`;

      logger.info(`融合${fusionSuccess ? '成功' : '失败'}：userId=${userId}, target=${targetRarity}, useProtection=${useProtection}`);

      return {
        success: true,
        message,
        result
      };
    } catch (error: any) {
      logger.error('执行融合失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 生成随机星宠名称
   */
  private generatePetName(rarity: PetRarity): string {
    const commonNames = ['星尘', '月影', '晨曦', '暮光', '流星'];
    const rareNames = ['星辰', '银河', '极光', '星河', '星云'];
    const epicNames = ['天狼', '天琴', '北辰', '璇玑', '玉衡'];
    const legendaryNames = ['紫微', '天帝', '太一', '玄武', '朱雀'];
    const mythicNames = ['混沌', '鸿蒙', '太初', '无极', '永恒'];

    let names = commonNames;
    switch (rarity) {
      case PetRarity.RARE:
        names = rareNames;
        break;
      case PetRarity.EPIC:
        names = epicNames;
        break;
      case PetRarity.LEGENDARY:
        names = legendaryNames;
        break;
      case PetRarity.MYTHIC:
        names = mythicNames;
        break;
    }

    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * 获取融合历史
   */
  async getFusionHistory(userId: string, limit: number = 20): Promise<any[]> {
    const attempts = await prisma.fusionAttempt.findMany({
      where: { userId },
      include: {
        materials: {
          select: {
            petRarity: true,
            petLevel: true
          }
        },
        resultPet: {
          select: {
            id: true,
            name: true,
            rarity: true,
            level: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    });

    return attempts;
  }
}

export const fusionService = new FusionService();

