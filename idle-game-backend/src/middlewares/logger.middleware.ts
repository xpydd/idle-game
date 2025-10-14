import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * 请求日志中间件
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // 生成请求ID
  req.requestId = randomUUID();

  const startTime = Date.now();

  // 记录请求信息
  logger.info('收到请求', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('响应完成', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
}

export default requestLogger;

