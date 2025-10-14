import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireKYC } from '../middlewares/kyc.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { walletService } from '../services/wallet.service.js';
import { Currency, TransactionType } from '@prisma/client';

const router = Router();

/**
 * GET /api/wallet/balance
 * 获取钱包余额
 */
router.get('/balance', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const wallet = await walletService.getBalance(userId);

  res.json({
    success: true,
    data: {
      gemBalance: wallet.gemBalance,
      shellBalance: wallet.shellBalance,
      energy: wallet.energy,
      maxEnergy: 100,
      lastEnergyUpdate: wallet.lastEnergyUpdate
    },
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/wallet/transactions
 * 获取交易流水
 */
router.get('/transactions', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { limit, offset, currency, type } = req.query;

  const result = await walletService.getTransactions(userId, {
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
    currency: currency as Currency,
    type: type as TransactionType
  });

  res.json({
    success: true,
    data: result,
    serverTime: new Date().toISOString()
  });
}));

export default router;

