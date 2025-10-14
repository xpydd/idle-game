import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireKYC } from '../middlewares/kyc.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { afkService } from '../services/afk.service.js';

const router = Router();

/**
 * POST /api/afk/start
 * 开启挂机
 */
router.post('/start', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { autoRefill } = req.body;

  const result = await afkService.startAFK(userId, autoRefill);

  res.json({
    success: result.success,
    message: result.message,
    data: result.startTime ? { startTime: result.startTime } : undefined,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/afk/claim
 * 领取挂机收益
 */
router.post('/claim', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const result = await afkService.claimRewards(userId);

  res.json({
    success: result.success,
    message: result.message,
    data: result.rewards,
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/afk/status
 * 获取挂机状态
 */
router.get('/status', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const status = await afkService.getAFKStatus(userId);

  res.json({
    success: true,
    data: status,
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/afk/offline-rewards
 * 获取离线收益（用户登录时调用）
 */
router.get('/offline-rewards', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { lastLoginTime } = req.query;

  if (!lastLoginTime) {
    return res.status(400).json({
      success: false,
      error: '缺少lastLoginTime参数'
    });
  }

  const rewards = await afkService.calculateOfflineRewards(
    userId,
    new Date(lastLoginTime as string)
  );

  res.json({
    success: true,
    data: rewards,
    serverTime: new Date().toISOString()
  });
}));

export default router;

