import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { socialService } from '../services/social.service.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/social/search
 * 搜索用户
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词（手机号或邀请码）',
      });
    }

    const user = await socialService.searchUser(query);

    if (!user) {
      return res.json({
        success: false,
        message: '未找到该用户',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * GET /api/social/friends
 * 获取好友列表
 */
router.get(
  '/friends',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const friends = await socialService.getFriendList(userId);

    res.json({
      success: true,
      data: {
        friends,
        total: friends.length,
      },
    });
  })
);

/**
 * GET /api/social/requests
 * 获取待处理的好友请求
 */
router.get(
  '/requests',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const requests = await socialService.getPendingRequests(userId);

    res.json({
      success: true,
      data: {
        requests,
        total: requests.length,
      },
    });
  })
);

/**
 * POST /api/social/friend/request
 * 发送好友请求
 */
router.post(
  '/friend/request',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供好友ID',
      });
    }

    try {
      await socialService.sendFriendRequest(userId, friendId);

      res.json({
        success: true,
        message: '好友请求已发送',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '发送请求失败',
      });
    }
  })
);

/**
 * POST /api/social/friend/accept
 * 接受好友请求
 */
router.post(
  '/friend/accept',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供请求ID',
      });
    }

    try {
      await socialService.acceptFriendRequest(userId, requestId);

      res.json({
        success: true,
        message: '已接受好友请求',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '接受请求失败',
      });
    }
  })
);

/**
 * POST /api/social/friend/reject
 * 拒绝好友请求
 */
router.post(
  '/friend/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供请求ID',
      });
    }

    try {
      await socialService.rejectFriendRequest(userId, requestId);

      res.json({
        success: true,
        message: '已拒绝好友请求',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '拒绝请求失败',
      });
    }
  })
);

/**
 * DELETE /api/social/friend/:friendId
 * 删除好友
 */
router.delete(
  '/friend/:friendId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { friendId } = req.params;

    try {
      await socialService.removeFriend(userId, friendId);

      res.json({
        success: true,
        message: '已删除好友',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '删除好友失败',
      });
    }
  })
);

/**
 * POST /api/social/assist
 * 助力好友
 */
router.post(
  '/assist',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供好友ID',
      });
    }

    try {
      const result = await socialService.assistFriend(userId, friendId);

      res.json({
        success: true,
        data: result,
        message: `助力成功！好友获得${result.energyGain}点能量`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '助力失败',
      });
    }
  })
);

/**
 * GET /api/social/assist/count
 * 获取今日助力次数
 */
router.get(
  '/assist/count',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const count = await socialService.getTodayAssistCount(userId);

    res.json({
      success: true,
      data: {
        todayCount: count,
        maxDaily: 3,
        remaining: Math.max(0, 3 - count),
      },
    });
  })
);

/**
 * POST /api/social/invite/bind
 * 绑定邀请码
 */
router.post(
  '/invite/bind',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        message: '参数错误：请提供邀请码',
      });
    }

    try {
      const result = await socialService.bindInviteCode(userId, code.toUpperCase());

      res.json({
        success: true,
        data: result,
        message: `绑定成功！您获得${result.inviteeReward}宝石`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || '绑定失败',
      });
    }
  })
);

/**
 * GET /api/social/invite/records
 * 获取邀请记录
 */
router.get(
  '/invite/records',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const records = await socialService.getInvitationRecords(userId);

    res.json({
      success: true,
      data: {
        records,
        total: records.length,
      },
    });
  })
);

/**
 * GET /api/social/invite/stats
 * 获取邀请统计
 */
router.get(
  '/invite/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const stats = await socialService.getInvitationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  })
);

export default router;

