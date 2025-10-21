import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { loginRateLimiter } from '../middlewares/rateLimit.middleware.js';
import { authService } from '../services/auth.service.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';

const router = Router();

/**
 * POST /api/auth/send-code
 * 发送验证码
 */
router.post('/send-code', loginRateLimiter, asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: '手机号不能为空'
    });
  }

  await authService.sendVerificationCode(phone);

  res.json({
    success: true,
    message: '验证码已发送',
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/auth/login
 * 手机号验证码登录
 */
router.post('/login', loginRateLimiter, asyncHandler(async (req, res) => {
  const { phone, code, deviceId } = req.body;

  // 参数验证
  if (!phone || !code || !deviceId) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }

  // 执行登录
  const result = await authService.loginWithPhone(phone, code, deviceId);

  res.json({
    success: true,
    message: '登录成功',
    data: result,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/auth/register-password
 * 账号密码注册
 */
router.post('/register-password', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const result = await authService.registerWithPassword({ username, email, password });
  res.json({ success: true, message: '注册成功', data: result, serverTime: new Date().toISOString() });
}));

/**
 * POST /api/auth/login-password
 * 账号密码登录
 */
router.post('/login-password', asyncHandler(async (req, res) => {
  const { identifier, password, deviceId } = req.body; // identifier 可为 username 或 email
  const result = await authService.loginWithPassword({ identifier, password, deviceId });
  res.json({ success: true, message: '登录成功', data: result, serverTime: new Date().toISOString() });
}));

/**
 * POST /api/auth/refresh
 * 刷新token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: '缺少refresh token'
    });
  }

  const result = await authService.refreshToken(refreshToken);

  res.json({
    success: true,
    message: 'Token刷新成功',
    data: result,
    serverTime: new Date().toISOString()
  });
}));

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  // 将当前token加入黑名单
  const authHeader = req.headers.authorization!;
  const token = authHeader.substring(7);
  blacklistToken(token, 60 * 60 * 24); // 黑名单有效期1天

  await authService.logout(userId);

  res.json({
    success: true,
    message: '登出成功',
    serverTime: new Date().toISOString()
  });
}));

export default router;

