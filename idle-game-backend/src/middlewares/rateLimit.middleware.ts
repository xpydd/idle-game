import rateLimit from 'express-rate-limit';

/**
 * 全局限流中间件
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 最多1000次请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 跳过健康检查接口
    return req.path === '/health';
  }
});

/**
 * 严格限流（用于敏感接口）
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次请求
  message: '操作过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 登录限流
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  message: '登录尝试次数过多，请15分钟后再试',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false
});

export default rateLimiter;

