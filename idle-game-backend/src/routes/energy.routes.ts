import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { energyService } from '../services/energy.service.js';

const router = Router();

router.use(authenticate);

/**
 * POST /api/energy/buy
 * 购买能量
 */
router.post(
  '/buy',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { quantity } = req.body;

    if (!quantity || typeof quantity !== 'number') {
      return res.status(400).json({
        success: false,
        message: '请提供有效的购买数量',
      });
    }

    const result = await energyService.buyEnergy(userId, quantity);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * GET /api/energy/purchase-info
 * 查询今日购买情况
 */
router.get(
  '/purchase-info',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const info = await energyService.getTodayPurchase(userId);

    res.json({
      success: true,
      data: info,
    });
  })
);

export default router;

