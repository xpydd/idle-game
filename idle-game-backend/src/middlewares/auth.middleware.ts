import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware.js';
import { JWTPayload } from '../types/index.js';
import { isTokenBlacklisted } from '../utils/tokenBlacklist.js';

/**
 * JWT 认证中间件
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // 从请求头获取 token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('未提供认证令牌', 401);
    }

    const token = authHeader.substring(7);
    // 检查是否在黑名单
    if (isTokenBlacklisted(token)) {
      throw new AppError('认证令牌已失效', 401);
    }
    
    // 验证 token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET 未配置');
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // 将用户信息附加到请求对象
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('认证令牌已过期', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('无效的认证令牌', 401));
    } else {
      next(error);
    }
  }
}

/**
 * 可选认证中间件（不强制要求登录）
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET;
      
      if (secret) {
        const decoded = jwt.verify(token, secret) as JWTPayload;
        req.user = decoded;
      }
    }
    
    next();
  } catch (error) {
    // 忽略错误，继续处理请求
    next();
  }
}

/**
 * 设备绑定校验中间件
 */
export function verifyDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const deviceId = req.headers['x-device-id'] as string;
    
    if (!deviceId) {
      throw new AppError('缺少设备标识', 400);
    }
    
    // 验证设备ID是否与JWT中的一致
    if (req.user && req.user.deviceId !== deviceId) {
      throw new AppError('设备标识不匹配', 403);
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

export default authenticate;

// 向后兼容的命名导出别名，保持路由中的 import { authenticateToken }
export const authenticateToken = authenticate;

