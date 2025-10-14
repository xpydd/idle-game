import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { KYCStatus } from '@prisma/client';

/**
 * 实名认证状态校验中间件
 * 用于需要实名认证才能访问的接口
 */
export const requireKYC = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }

    // 查询用户认证状态
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 检查是否已完成实名认证
    if (user.kycStatus !== KYCStatus.VERIFIED) {
      return res.status(403).json({
        success: false,
        error: '请先完成实名认证',
        kycStatus: user.kycStatus,
        needKYC: true
      });
    }

    // 认证通过，继续执行
    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: '认证状态校验失败'
    });
  }
};

