import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

// 导入路由
import authRoutes from './routes/auth.routes.js';
import kycRoutes from './routes/kyc.routes.js';
import userRoutes from './routes/user.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import petRoutes from './routes/pet.routes.js';
import afkRoutes from './routes/afk.routes.js';
import shopRoutes from './routes/shop.routes.js';
import fusionRoutes from './routes/fusion.routes.js';
import mineRoutes from './routes/mine.routes.js';
import socialRoutes from './routes/social.routes.js';
import taskRoutes from './routes/task.routes.js';
import levelRoutes from './routes/level.routes.js';
import energyRoutes from './routes/energy.routes.js';
import achievementRoutes from './routes/achievement.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

// 导入中间件
import { errorHandler } from './middlewares/error.middleware.js';
import { requestLogger } from './middlewares/logger.middleware.js';
import { rateLimiter } from './middlewares/rateLimit.middleware.js';

// 导入工具
import { logger } from './utils/logger.js';
import { initializeCronJobs } from './utils/cron.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 基础中间件
app.use(helmet()); // 安全头
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']).concat(['capacitor://localhost']),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger); // 请求日志
app.use(rateLimiter); // 限流

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/afk', afkRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/fusion', fusionRoutes);
app.use('/api/mine', mineRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/level', levelRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api/achievement', achievementRoutes);
app.use('/api/analytics', analyticsRoutes);

// 错误处理中间件
app.use(errorHandler);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// 创建 HTTP 服务器
const server = createServer(app);

// 启动服务器
server.listen(PORT, HOST, () => {
  logger.info(`🚀 服务器启动成功`);
  logger.info(`📍 地址: http://${HOST}:${PORT}`);
  logger.info(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 初始化定时任务
  initializeCronJobs();
  logger.info('⏰ 定时任务已初始化');
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，开始优雅关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，开始优雅关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

export default app;

