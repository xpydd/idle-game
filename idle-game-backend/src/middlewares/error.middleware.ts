import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ApiResponse } from '../types/index.js';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 错误处理中间件
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let statusCode = 500;
  let message = '服务器内部错误';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '请求参数验证失败';
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '未授权访问';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token 已过期';
  }

  // 记录错误日志
  logger.error('请求错误:', {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    statusCode,
    message: err.message,
    stack: err.stack,
    user: req.user?.userId
  });

  // 返回错误响应
  const response: ApiResponse = {
    success: false,
    error: message,
    requestId: req.requestId,
    serverTime: new Date().toISOString()
  };

  // 在开发环境中返回堆栈信息
  if (process.env.NODE_ENV === 'development') {
    response.data = {
      stack: err.stack,
      details: err.message
    };
  }

  res.status(statusCode).json(response);
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response) {
  const response: ApiResponse = {
    success: false,
    error: 'Not Found',
    message: `路由 ${req.method} ${req.path} 不存在`,
    requestId: req.requestId,
    serverTime: new Date().toISOString()
  };

  res.status(404).json(response);
}

/**
 * 异步路由错误捕获包装器
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;

