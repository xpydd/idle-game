import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { mineService } from '../services/mine.service.js';
import { walletService } from '../services/wallet.service.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/mine/list
 * 获取矿点列表和用户状态
 */
router.get(
  '/list',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // 获取矿点列表
    const spots = mineService.getMineSpots();

    // 获取用户钱包状态
    const wallet = await walletService.getBalance(userId);

    // 获取当前挑战状态
    const challengeStatus = await mineService.getChallengeStatus(userId);

    res.json({
      success: true,
      data: {
        spots,
        wallet: {
          mineTicket: wallet.mineTicket,
          energy: wallet.energy,
        },
        currentChallenge: challengeStatus,
      },
    });
  })
);

/**
 * POST /api/mine/enter
 * 进入矿点挑战
 */
router.post(
  '/enter',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { spotLevel } = req.body;

    if (!spotLevel || typeof spotLevel !== 'number') {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供有效的矿点等级',
      });
    }

    try {
      const result = await mineService.enterChallenge(userId, spotLevel);

      res.json({
        success: true,
        data: result,
        message: `成功进入${result.spotName}！`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '进入矿点失败',
      });
    }
  })
);

/**
 * POST /api/mine/claim
 * 领取矿点奖励
 */
router.post(
  '/claim',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { challengeId } = req.body;

    if (!challengeId) {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供挑战ID',
      });
    }

    try {
      const rewards = await mineService.claimRewards(userId, challengeId);

      res.json({
        success: true,
        data: rewards,
        message: `恭喜完成${rewards.spotName}！`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '领取奖励失败',
      });
    }
  })
);

/**
 * GET /api/mine/status
 * 获取当前挑战状态
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const status = await mineService.getChallengeStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * GET /api/mine/history
 * 获取挑战历史
 */
router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await mineService.getChallengeHistory(userId, limit);

    res.json({
      success: true,
      data: {
        history,
        total: history.length,
      },
    });
  })
);

export default router;

