import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// 自定义日志格式
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

// 创建 logger 实例
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// 在生产环境中，不输出到控制台
if (process.env.NODE_ENV === 'production') {
  logger.transports.forEach((transport) => {
    if (transport instanceof winston.transports.Console) {
      transport.silent = true;
    }
  });
}

export default logger;

