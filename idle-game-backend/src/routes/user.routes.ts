import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { userService } from '../services/user.service.js';

const router = Router();

/**
 * GET /api/user/profile
 * 获取用户完整信息
 */
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const profile = await userService.getUserProfile(userId);

  res.json({
    success: true,
    data: profile,
    serverTime: new Date().toISOString()
  });
}));

/**
 * PUT /api/user/profile
 * 更新用户信息
 */
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { nickname, avatar } = req.body;

  const result = await userService.updateUserProfile(userId, {
    nickname,
    avatar
  });

  res.json({
    success: true,
    message: result.message,
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/user/stats
 * 获取用户统计信息
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const stats = await userService.getUserStats(userId);

  res.json({
    success: true,
    data: stats,
    serverTime: new Date().toISOString()
  });
}));

export default router;

