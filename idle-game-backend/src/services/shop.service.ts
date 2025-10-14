import { prisma } from '../db/prisma.js';
import { PetRarity, ShopItemType, Currency } from '@prisma/client';
import { walletService } from './wallet.service.js';
import logger from '../utils/logger.js';

/**
 * 商店服务
 */
class ShopService {
  /**
   * 获取商品列表
   * 包含用户今日购买情况
   */
  async getItems(userId: string) {
    try {
      // 查询所有上架商品
      const items = await prisma.shopItem.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          sortOrder: 'asc'
        }
      });

      // 查询用户今日购买记录
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayPurchases = await prisma.shopPurchase.groupBy({
        by: ['sku'],
        where: {
          userId,
          purchaseDate: {
            gte: today
          }
        },
        _sum: {
          quantity: true
        }
      });

      // 构建购买记录映射
      const purchaseMap = new Map(
        todayPurchases.map(p => [p.sku, p._sum.quantity || 0])
      );

      // 组装返回数据
      return items.map(item => ({
        ...item,
        todayPurchased: purchaseMap.get(item.sku) || 0,
        remainingDaily: item.dailyLimit 
          ? Math.max(0, item.dailyLimit - (purchaseMap.get(item.sku) || 0))
          : null,
        canPurchase: this.canPurchaseItem(item, purchaseMap.get(item.sku) || 0)
      }));
    } catch (error: any) {
      logger.error('获取商品列表失败', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * 检查是否可以购买
   */
  private canPurchaseItem(item: any, todayPurchased: number): boolean {
    // 检查库存
    if (item.totalStock !== -1 && item.totalStock <= 0) {
      return false;
    }

    // 检查日限购
    if (item.dailyLimit && todayPurchased >= item.dailyLimit) {
      return false;
    }

    return true;
  }

  /**
   * 兑换商品
   */
  async exchange(
    userId: string,
    sku: string,
    quantity: number = 1
  ): Promise<{
    success: boolean;
    message: string;
    rewards?: any;
  }> {
    try {
      // 查询商品
      const item = await prisma.shopItem.findUnique({
        where: { sku, isActive: true }
      });

      if (!item) {
        return {
          success: false,
          message: '商品不存在或已下架'
        };
      }

      // 检查库存
      if (item.totalStock !== -1 && item.totalStock < quantity) {
        return {
          success: false,
          message: '库存不足'
        };
      }

      // 检查日限购
      if (item.dailyLimit) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayPurchased = await prisma.shopPurchase.aggregate({
          where: {
            userId,
            sku,
            purchaseDate: {
              gte: today
            }
          },
          _sum: {
            quantity: true
          }
        });

        const purchased = todayPurchased._sum.quantity || 0;
        if (purchased + quantity > item.dailyLimit) {
          return {
            success: false,
            message: `今日限购${item.dailyLimit}个，您已购买${purchased}个`
          };
        }
      }

      // 计算总价
      const totalPrice = item.price * quantity;

      // 检查余额
      const wallet = await walletService.getBalance(userId);
      if (item.currency === Currency.GEM) {
        if (wallet.gemBalance < totalPrice) {
          return {
            success: false,
            message: '宝石余额不足'
          };
        }
      } else if (item.currency === Currency.SHELL) {
        if (wallet.shellBalance < totalPrice) {
          return {
            success: false,
            message: '贝壳余额不足'
          };
        }
      }

      // 使用事务处理兑换
      const result = await prisma.$transaction(async (tx) => {
        // 扣除货币
        if (item.currency === Currency.GEM) {
          await walletService.updateGems(
            userId,
            -totalPrice,
            'SPEND',
            '商店兑换',
            `兑换${item.name} x${quantity}`
          );
        } else {
          await walletService.updateShells(
            userId,
            -totalPrice,
            'SPEND',
            '商店兑换',
            `兑换${item.name} x${quantity}`
          );
        }

        // 扣减库存
        if (item.totalStock !== -1) {
          await tx.shopItem.update({
            where: { sku },
            data: {
              totalStock: {
                decrement: quantity
              }
            }
          });
        }

        // 记录购买
        await tx.shopPurchase.create({
          data: {
            userId,
            sku,
            quantity,
            totalPrice,
            currency: item.currency
          }
        });

        // 发放商品
        const rewards = await this.grantItem(userId, item, quantity, tx);

        return rewards;
      });

      logger.info(`商品兑换成功：userId=${userId}, sku=${sku}, quantity=${quantity}`);

      return {
        success: true,
        message: '兑换成功',
        rewards: result
      };
    } catch (error: any) {
      logger.error('兑换商品失败', { error: error.message, userId, sku });
      throw error;
    }
  }

  /**
   * 发放商品
   */
  private async grantItem(
    userId: string,
    item: any,
    quantity: number,
    tx: any
  ): Promise<any> {
    switch (item.type) {
      case ShopItemType.PET_EGG:
        // 孵化星宠蛋
        return await this.openEgg(userId, item.rarity, quantity, tx);

      case ShopItemType.ENERGY:
        // 增加能量
        await tx.wallet.update({
          where: { userId },
          data: {
            energy: {
              increment: quantity * 10 // 假设每个商品增加10能量
            }
          }
        });
        return { type: 'ENERGY', amount: quantity * 10 };

      case ShopItemType.TICKET:
        // 增加矿票
        await tx.wallet.update({
          where: { userId },
          data: {
            mineTicket: {
              increment: quantity
            }
          }
        });
        return { type: 'TICKET', amount: quantity };

      default:
        // 其他道具（预留）
        return { type: item.type, amount: quantity };
    }
  }

  /**
   * 孵化星宠蛋
   * 根据蛋的稀有度生成星宠
   */
  private async openEgg(
    userId: string,
    eggRarity: PetRarity | null,
    quantity: number,
    tx: any
  ): Promise<any> {
    const pets = [];

    for (let i = 0; i < quantity; i++) {
      // 根据蛋的稀有度决定星宠稀有度
      const petRarity = this.determinePetRarity(eggRarity);

      // 创建星宠
      const pet = await tx.pet.create({
        data: {
          userId,
          rarity: petRarity,
          level: 1,
          exp: 0,
          name: this.generatePetName(petRarity)
        }
      });

      pets.push(pet);
    }

    return {
      type: 'PET',
      pets
    };
  }

  /**
   * 根据蛋的稀有度决定星宠稀有度
   * 有一定概率获得更高稀有度的星宠
   */
  private determinePetRarity(eggRarity: PetRarity | null): PetRarity {
    if (!eggRarity) {
      return PetRarity.COMMON;
    }

    const random = Math.random();

    switch (eggRarity) {
      case PetRarity.COMMON:
        // 普通蛋：80%普通，20%稀有
        return random < 0.8 ? PetRarity.COMMON : PetRarity.RARE;

      case PetRarity.RARE:
        // 稀有蛋：70%稀有，25%史诗，5%传说
        if (random < 0.70) return PetRarity.RARE;
        if (random < 0.95) return PetRarity.EPIC;
        return PetRarity.LEGENDARY;

      case PetRarity.EPIC:
        // 史诗蛋：60%史诗，35%传说，5%神话
        if (random < 0.60) return PetRarity.EPIC;
        if (random < 0.95) return PetRarity.LEGENDARY;
        return PetRarity.MYTHIC;

      case PetRarity.LEGENDARY:
        // 传说蛋：70%传说，30%神话
        return random < 0.70 ? PetRarity.LEGENDARY : PetRarity.MYTHIC;

      case PetRarity.MYTHIC:
        // 神话蛋：100%神话
        return PetRarity.MYTHIC;

      default:
        return PetRarity.COMMON;
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
   * 初始化商品数据（仅首次运行时）
   */
  async initializeShopItems() {
    try {
      const count = await prisma.shopItem.count();
      if (count > 0) {
        logger.info('商品已初始化，跳过');
        return;
      }

      const items = [
        // 星宠蛋
        {
          sku: 'pet_egg_common',
          name: '普通星宠蛋',
          description: '孵化后获得普通或稀有星宠',
          type: ShopItemType.PET_EGG,
          rarity: PetRarity.COMMON,
          price: 100,
          currency: Currency.SHELL,
          dailyLimit: null,
          totalStock: -1,
          resetType: null,
          sortOrder: 1
        },
        {
          sku: 'pet_egg_rare',
          name: '稀有星宠蛋',
          description: '孵化后获得稀有、史诗或传说星宠',
          type: ShopItemType.PET_EGG,
          rarity: PetRarity.RARE,
          price: 500,
          currency: Currency.SHELL,
          dailyLimit: 3,
          totalStock: -1,
          resetType: 'DAILY',
          sortOrder: 2
        },
        {
          sku: 'pet_egg_epic',
          name: '史诗星宠蛋',
          description: '孵化后获得史诗、传说或神话星宠',
          type: ShopItemType.PET_EGG,
          rarity: PetRarity.EPIC,
          price: 2000,
          currency: Currency.SHELL,
          dailyLimit: 1,
          totalStock: -1,
          resetType: 'DAILY',
          sortOrder: 3
        },
        // 能量
        {
          sku: 'energy_pack_small',
          name: '小型能量包',
          description: '立即获得20点能量',
          type: ShopItemType.ENERGY,
          rarity: null,
          price: 100,
          currency: Currency.SHELL,
          dailyLimit: 10,
          totalStock: -1,
          resetType: 'DAILY',
          sortOrder: 10
        }
      ];

      await prisma.shopItem.createMany({
        data: items
      });

      logger.info(`商品初始化完成，共${items.length}个商品`);
    } catch (error: any) {
      logger.error('初始化商品失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 重置每日限购记录
   */
  async resetDailyPurchases(): Promise<number> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      // 删除昨天及之前的购买记录
      const result = await prisma.shopPurchase.deleteMany({
        where: {
          purchaseDate: {
            lte: yesterday
          }
        }
      });

      logger.info(`每日限购记录重置完成，清理${result.count}条记录`);
      return result.count;
    } catch (error: any) {
      logger.error('重置每日限购失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 重置每周限购记录（预留）
   */
  async resetWeeklyPurchases(): Promise<number> {
    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const result = await prisma.shopPurchase.deleteMany({
        where: {
          purchaseDate: {
            lte: lastWeek
          }
        }
      });

      logger.info(`每周限购记录重置完成，清理${result.count}条记录`);
      return result.count;
    } catch (error: any) {
      logger.error('重置每周限购失败', { error: error.message });
      throw error;
    }
  }
}

export const shopService = new ShopService();

