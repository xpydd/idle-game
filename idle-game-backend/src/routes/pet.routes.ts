import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { requireKYC } from '../middlewares/kyc.middleware.js';
import { petService } from '../services/pet.service.js';
import { levelService } from '../services/level.service.js';

const router = Router();

/**
 * POST /api/pet/grant-newbie
 * 手动领取新手星宠（通常由认证成功自动触发，此接口作为备用）
 */
router.post('/grant-newbie', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const result = await petService.grantNewbiePet(userId);

  res.json({
    success: result.success,
    message: result.message,
    data: result.pet,
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/pet/list
 * 获取星宠列表（支持筛选、排序、分页）
 * Query参数：
 *   - rarity: 筛选稀有度（COMMON/RARE/EPIC/LEGENDARY/MYTHIC）
 *   - sortBy: 排序字段（rarity/level/exp/createdAt）
 *   - sortOrder: 排序方向（asc/desc）
 *   - page: 页码（默认1）
 *   - limit: 每页数量（默认20）
 */
router.get('/list', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { rarity, sortBy, sortOrder, page, limit } = req.query;

  const result = await petService.getUserPets(userId, {
    rarity: rarity as any,
    sortBy: sortBy as any,
    sortOrder: sortOrder as any,
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined
  });

  res.json({
    success: true,
    data: result.pets,
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      limit: limit ? parseInt(limit as string) : 20
    },
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/pet/stats
 * 获取星宠统计信息
 */
router.get('/stats', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const stats = await petService.getPetStats(userId);

  res.json({
    success: true,
    data: stats,
    serverTime: new Date().toISOString()
  });
}));

/**
 * GET /api/pet/:petId
 * 获取星宠详情（包含统计信息）
 */
router.get('/:petId', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { petId } = req.params;

  const pet = await petService.getPetById(petId, userId);

  res.json({
    success: true,
    data: pet,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/pet/levelup
 * 星宠升级
 */
router.post('/levelup', authenticateToken, requireKYC, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { petId, expGain } = req.body;

  if (!petId) {
    return res.status(400).json({ success: false, error: '缺少petId' });
  }

  // 校验宠物归属
  const pet = await petService.getPetById(petId, userId);

  // 可选：支持一次性增加经验，否则默认+1经验（用于手动触发小幅升级/测试）
  const gain = typeof expGain === 'number' && expGain > 0 ? expGain : 1;

  const result = await levelService.addExp(pet.id, gain);

  res.json({
    success: true,
    message: result.leveledUp ? '升级成功' : '经验增加',
    data: {
      pet: result.pet,
      levelUp: result.leveledUp ? {
        petName: result.pet.name,
        oldLevel: result.pet.level - result.levelsGained,
        newLevel: result.pet.level,
        levelsGained: result.levelsGained
      } : undefined
    },
    serverTime: new Date().toISOString()
  });
}));

export default router;

