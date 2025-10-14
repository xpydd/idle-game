import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { achievementService } from '../services/achievement.service.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/achievement/list
 * 获取用户成就列表
 */
router.get(
  '/list',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const result = await achievementService.getUserAchievements(userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: '获取成就列表失败',
      });
    }

    res.json(result);
  })
);

/**
 * POST /api/achievement/claim
 * 领取成就奖励
 */
router.post(
  '/claim',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { achievementId } = req.body;

    if (!achievementId) {
      return res.status(400).json({
        success: false,
        message: '请提供成就ID',
      });
    }

    const result = await achievementService.claimAchievement(userId, achievementId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

export default router;

