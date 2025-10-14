import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireKYC } from '../middlewares/kyc.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { taskService } from '../services/task.service.js';

const router = Router();

/**
 * GET /api/task/list
 * 获取用户任务列表
 */
router.get('/list', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const tasks = await taskService.getUserTasks(userId);

  res.json({
    success: true,
    data: tasks,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/task/claim
 * 领取任务奖励
 */
router.post('/claim', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { userTaskId } = req.body;

  if (!userTaskId) {
    return res.status(400).json({
      success: false,
      error: '缺少任务ID'
    });
  }

  const result = await taskService.claimTaskReward(userId, userTaskId);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.message
    });
  }

  res.json({
    success: true,
    message: result.message,
    data: {
      rewards: result.rewards
    },
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/task/init
 * 初始化任务（仅开发/首次运行）
 */
router.post('/init', asyncHandler(async (req, res) => {
  await taskService.initializeTasks();

  res.json({
    success: true,
    message: '任务初始化完成',
    serverTime: new Date().toISOString()
  });
}));

export default router;

