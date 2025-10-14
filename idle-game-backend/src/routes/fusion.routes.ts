import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireKYC } from '../middlewares/kyc.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { fusionService } from '../services/fusion.service.js';

const router = Router();

/**
 * GET /api/fusion/rules
 * 获取融合规则列表
 */
router.get('/rules', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const rules = fusionService.getFusionRules();

  res.json({
    success: true,
    data: rules,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/fusion/validate
 * 验证材料是否满足要求
 */
router.post('/validate', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { materialPetIds, targetRarity } = req.body;

  if (!materialPetIds || !Array.isArray(materialPetIds)) {
    return res.status(400).json({
      success: false,
      error: '缺少材料星宠ID列表'
    });
  }

  if (!targetRarity) {
    return res.status(400).json({
      success: false,
      error: '缺少目标稀有度'
    });
  }

  const validation = await fusionService.validateMaterials(userId, materialPetIds, targetRarity);

  res.json({
    success: validation.valid,
    message: validation.message,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/fusion/attempt
 * 尝试融合
 */
router.post('/attempt', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { materialPetIds, targetRarity, useProtection = false } = req.body;

  if (!materialPetIds || !Array.isArray(materialPetIds)) {
    return res.status(400).json({
      success: false,
      error: '缺少材料星宠ID列表'
    });
  }

  if (!targetRarity) {
    return res.status(400).json({
      success: false,
      error: '缺少目标稀有度'
    });
  }

  const result = await fusionService.attemptFusion(
    userId,
    materialPetIds,
    targetRarity,
    useProtection
  );

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.message
    });
  }

  res.json({
    success: true,
    message: result.message,
    data: result.result,
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/fusion/history
 * 获取融合历史
 */
router.get('/history', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

  const history = await fusionService.getFusionHistory(userId, limit);

  res.json({
    success: true,
    data: history,
    serverTime: new Date().toISOString()
  });
}));

export default router;

