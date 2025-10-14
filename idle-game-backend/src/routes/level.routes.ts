import { Router, Request, Response } from 'express';
import { levelService } from '../services/level.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/level/exp-table
 * 获取经验值表
 */
router.get(
  '/exp-table',
  asyncHandler(async (req: Request, res: Response) => {
    const expTable = levelService.getExpTable();
    
    res.json({
      success: true,
      data: expTable,
    });
  })
);

/**
 * GET /api/level/pet/:petId
 * 获取星宠的经验进度信息
 */
router.get(
  '/pet/:petId',
  asyncHandler(async (req: Request, res: Response) => {
    const { petId } = req.params;
    const userId = req.user!.userId;

    // 验证星宠是否属于当前用户
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: '星宠不存在',
      });
    }

    if (pet.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问该星宠',
      });
    }

    const progress = levelService.getExpProgress(pet);

    res.json({
      success: true,
      data: progress,
    });

    await prisma.$disconnect();
  })
);

/**
 * POST /api/level/add-exp
 * 为星宠增加经验值（测试/管理员接口）
 */
router.post(
  '/add-exp',
  asyncHandler(async (req: Request, res: Response) => {
    const { petId, expGain } = req.body;
    const userId = req.user!.userId;

    if (!petId || typeof expGain !== 'number' || expGain <= 0) {
      return res.status(400).json({
        success: false,
        message: '参数错误',
      });
    }

    // 验证星宠是否属于当前用户
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: '星宠不存在',
      });
    }

    if (pet.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权操作该星宠',
      });
    }

    const result = await levelService.addExp(petId, expGain);

    res.json({
      success: true,
      data: result,
      message: result.leveledUp 
        ? `恭喜！星宠升到了 ${result.pet.level} 级！` 
        : `获得了 ${expGain} 点经验值`,
    });

    await prisma.$disconnect();
  })
);

/**
 * GET /api/level/user-stats
 * 获取用户星宠等级统计
 */
router.get(
  '/user-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const averageLevel = await levelService.getUserAverageLevel(userId);
    const highestLevelPet = await levelService.getUserHighestLevelPet(userId);

    res.json({
      success: true,
      data: {
        averageLevel,
        highestLevel: highestLevelPet?.level || 0,
        highestLevelPet: highestLevelPet ? {
          id: highestLevelPet.id,
          name: highestLevelPet.name,
          rarity: highestLevelPet.rarity,
          level: highestLevelPet.level,
          exp: highestLevelPet.exp,
          progress: levelService.getExpProgress(highestLevelPet),
        } : null,
      },
    });
  })
);

export default router;

