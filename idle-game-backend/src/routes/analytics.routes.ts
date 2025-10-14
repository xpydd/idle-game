import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { analyticsService } from '../services/analytics.service.js';

const router = Router();

// 注意：实际生产环境中，这些接口应该添加管理员权限验证
// 这里简化为只需要登录即可访问

router.use(authenticate);

/**
 * GET /api/analytics/overview
 * 获取综合统计数据
 */
router.get(
  '/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getOverallStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/analytics/users
 * 获取用户统计数据
 */
router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getUserStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/analytics/economy
 * 获取经济统计数据
 */
router.get(
  '/economy',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getEconomyStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/analytics/game
 * 获取游戏统计数据
 */
router.get(
  '/game',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getGameStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/analytics/social
 * 获取社交统计数据
 */
router.get(
  '/social',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getSocialStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/analytics/active-users
 * 获取活跃用户统计（DAU/WAU/MAU）
 */
router.get(
  '/active-users',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getActiveUserStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

export default router;

