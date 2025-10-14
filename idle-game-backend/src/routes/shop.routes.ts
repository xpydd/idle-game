import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireKYC } from '../middlewares/kyc.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { shopService } from '../services/shop.service.js';

const router = Router();

/**
 * GET /api/shop/list
 * 获取商品列表
 */
router.get('/list', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const items = await shopService.getItems(userId);

  res.json({
    success: true,
    data: items,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/shop/exchange
 * 兑换商品
 */
router.post('/exchange', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { sku, quantity = 1 } = req.body;

  if (!sku) {
    return res.status(400).json({
      success: false,
      error: '缺少商品SKU'
    });
  }

  const result = await shopService.exchange(userId, sku, quantity);

  res.json({
    success: result.success,
    message: result.message,
    data: result.rewards,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/shop/init
 * 初始化商品数据（仅开发/首次运行）
 */
router.post('/init', asyncHandler(async (req, res) => {
  await shopService.initializeShopItems();

  res.json({
    success: true,
    message: '商品初始化完成',
    serverTime: new Date().toISOString()
  });
}));

export default router;

