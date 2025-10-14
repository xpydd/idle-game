import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { kycService } from '../services/kyc.service.js';
import { petService } from '../services/pet.service.js';

const router = Router();

/**
 * POST /api/kyc/verify
 * 提交实名认证
 */
router.post('/verify', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { realName, idCard } = req.body;

  // 参数验证
  if (!realName || !idCard) {
    return res.status(400).json({
      success: false,
      error: '姓名和身份证号不能为空'
    });
  }

  // 执行实名认证
  const result = await kycService.verifyIdentity(userId, realName, idCard);

  // 如果认证成功，自动发放新手星宠
  let petInfo = null;
  if (result.success) {
    const petResult = await petService.grantNewbiePet(userId);
    if (petResult.success) {
      petInfo = petResult.pet;
    }
  }

  res.json({
    success: result.success,
    message: result.message,
    data: {
      kycStatus: result.kycStatus,
      pet: petInfo
    },
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/kyc/status
 * 查询认证状态
 */
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const kycInfo = await kycService.getKYCInfo(userId);

  res.json({
    success: true,
    data: kycInfo,
    serverTime: new Date().toISOString()
  });
}));

export default router;

