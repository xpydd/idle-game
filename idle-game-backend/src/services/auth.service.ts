import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { smsService } from './sms.service.js';
import { AppError } from '../middlewares/error.middleware.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * 认证服务
 */
class AuthService {
  /**
   * 账号密码注册
   */
  async registerWithPassword(params: { username?: string; email?: string; password: string; }): Promise<{ userId: string; username?: string; email?: string; }>{
    const { username, email } = params;
    const rawPassword = params.password || '';

    if ((!username || username.trim().length < 3) && (!email || email.trim().length === 0))
      throw new AppError('请提供用户名或邮箱', 400);
    if (rawPassword.length < 6)
      throw new AppError('密码长度至少6位', 400);

    const normalizedEmail = email ? email.trim().toLowerCase() : undefined;
    const normalizedUsername = username ? username.trim() : undefined;

    // 唯一性检查
    if (normalizedUsername) {
      const exists = await prisma.user.findUnique({ where: { username: normalizedUsername } });
      if (exists) throw new AppError('用户名已被占用', 409);
    }
    if (normalizedEmail) {
      const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (exists) throw new AppError('邮箱已被占用', 409);
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        deviceId: 'password',
        lastLoginAt: new Date()
      }
    });

    await prisma.wallet.create({
      data: { userId: user.id, gemBalance: 0, shellBalance: 0, energy: 100 }
    });

    logger.info(`新用户（密码）注册: ${user.id}`);
    return { userId: user.id, username: user.username ?? undefined, email: user.email ?? undefined };
  }

  /**
   * 账号密码登录（identifier: username 或 email）
   */
  async loginWithPassword(params: { identifier: string; password: string; deviceId: string }): Promise<{
    token: string; refreshToken: string; userId: string; needKYC: boolean;
  }>{
    const identifier = (params.identifier || '').trim();
    const password = params.password || '';
    const deviceId = params.deviceId || 'password';

    if (!identifier || !password) throw new AppError('缺少用户名/邮箱或密码', 400);

    const byEmail = identifier.includes('@');
    const user = await prisma.user.findUnique({
      where: byEmail ? { email: identifier.toLowerCase() } : { username: identifier }
    });

    if (!user || !user.passwordHash) {
      throw new AppError('账号或密码错误', 401);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError('账号或密码错误', 401);

    // 更新最近登录与设备
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), deviceId } });

    const tokenPayload = { userId: user.id, deviceId };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    logger.info(`用户（密码）登录: ${user.id}`);
    return { token, refreshToken, userId: user.id, needKYC: user.kycStatus !== 'VERIFIED' };
  }
  /**
   * 发送验证码
   */
  async sendVerificationCode(phone: string): Promise<void> {
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      throw new AppError('手机号格式不正确', 400);
    }

    // 简单防刷限制：同号码60秒冷却（由smsService实现）
    const canSend = smsService.canSendNow(phone);
    if (!canSend) {
      throw new AppError('发送过于频繁，请稍后再试', 429);
    }
    
    // 发送验证码
    const sent = await smsService.sendVerificationCode(phone);
    
    if (!sent) {
      throw new AppError('验证码发送失败，请稍后重试', 500);
    }

    logger.info(`验证码已发送到: ${phone}`);
  }

  /**
   * 手机号验证码登录
   */
  async loginWithPhone(
    phone: string,
    code: string,
    deviceId: string
  ): Promise<{
    token: string;
    refreshToken: string;
    userId: string;
    needKYC: boolean;
  }> {
    // 1. 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      throw new AppError('手机号格式不正确', 400);
    }

    // 2. 验证验证码
    const isValid = await smsService.verifyCode(phone, code);
    if (!isValid) {
      throw new AppError('验证码错误或已过期', 400);
    }

    // 3. 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      // 新用户注册
      user = await prisma.user.create({
        data: {
          phone,
          deviceId,
          lastLoginAt: new Date()
        }
      });

      // 创建钱包
      await prisma.wallet.create({
        data: {
          userId: user.id,
          gemBalance: 0,
          shellBalance: 0,
          energy: 100
        }
      });

      logger.info(`新用户注册: ${user.id}`);
    } else {
      // 更新登录时间和设备ID
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          deviceId
        }
      });

      logger.info(`用户登录: ${user.id}`);
    }

    // 4. 检查设备绑定限制（TODO: 使用Redis实现）
    // const deviceUsers = await this.getDeviceUsers(deviceId);
    // if (deviceUsers.length >= 2 && !deviceUsers.includes(user.id)) {
    //   throw new AppError('该设备登录账号数已达上限', 403);
    // }

    // 5. 生成JWT token
    const tokenPayload = {
      userId: user.id,
      deviceId
    };

    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 6. 记录登录日志
    logger.info(`用户 ${user.id} 登录成功`, {
      phone: user.phone,
      deviceId,
      kycStatus: user.kycStatus
    });

    return {
      token,
      refreshToken,
      userId: user.id,
      needKYC: user.kycStatus !== 'VERIFIED'
    };
  }

  /**
   * 刷新token
   */
  async refreshToken(refreshToken: string): Promise<{
    token: string;
    refreshToken: string;
  }> {
    // 验证refresh token
    const { verifyRefreshToken } = await import('../utils/jwt.js');
    
    try {
      const payload = verifyRefreshToken(refreshToken);
      
      // 验证用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) {
        throw new AppError('用户不存在', 404);
      }

      // 生成新的token
      const newToken = generateAccessToken({
        userId: user.id,
        deviceId: payload.deviceId
      });

      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        deviceId: payload.deviceId
      });

      return {
        token: newToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new AppError('刷新token失败', 401);
    }
  }

  /**
   * 登出
   */
  async logout(userId: string): Promise<void> {
    try {
      // 从上下文无法直接获得token，这里采用约定：在路由中读取并传入，或从header获取
      // 由于本服务层无 req 对象，这里仅记录日志；黑名单逻辑在路由中处理
      logger.info(`用户 ${userId} 登出`);
    } catch (error) {
      logger.warn('登出处理发生异常', error);
    }
  }
}

export const authService = new AuthService();
export default authService;

