# 星宠挂机后端服务

## 📋 项目简介

这是星宠挂机小游戏的后端API服务，基于 Node.js + Express + TypeScript 构建，提供游戏的核心业务逻辑和数据服务。

## 🚀 技术栈

- **Node.js** - JavaScript 运行环境
- **Express** - Web 框架
- **TypeScript** - 类型安全
- **Prisma** - ORM 数据库管理
- **PostgreSQL** - 主数据库
- **Redis** - 缓存和会话管理
- **JWT** - 身份认证
- **Winston** - 日志管理
- **Node-cron** - 定时任务

## 📂 项目结构

```
idle-game-backend/
├── src/
│   ├── app.ts                    # 应用入口
│   ├── types/                    # TypeScript 类型定义
│   │   └── index.ts
│   ├── routes/                   # 路由层
│   │   ├── auth.routes.ts        # 认证路由
│   │   ├── user.routes.ts        # 用户路由
│   │   ├── pet.routes.ts         # 星宠路由
│   │   ├── afk.routes.ts         # 挂机路由
│   │   ├── shop.routes.ts        # 商店路由
│   │   ├── fusion.routes.ts      # 融合路由
│   │   ├── mine.routes.ts        # 矿点路由
│   │   ├── social.routes.ts      # 社交路由
│   │   └── task.routes.ts        # 任务路由
│   ├── controllers/              # 控制器层（待实现）
│   ├── services/                 # 业务逻辑层（待实现）
│   ├── models/                   # 数据模型层（Prisma）
│   ├── middlewares/              # 中间件
│   │   ├── auth.middleware.ts    # 认证中间件
│   │   ├── error.middleware.ts   # 错误处理
│   │   ├── logger.middleware.ts  # 日志记录
│   │   └── rateLimit.middleware.ts # 限流
│   └── utils/                    # 工具函数
│       ├── logger.ts             # 日志工具
│       └── cron.ts               # 定时任务
├── dist/                         # 构建输出目录
├── logs/                         # 日志目录
├── prisma/                       # Prisma 配置和迁移
├── package.json                  # 项目配置
├── tsconfig.json                 # TypeScript 配置
├── .env.example                  # 环境变量示例
├── .gitignore                    # Git 忽略文件
└── README.md                     # 本文件
```

## 🛠️ 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接、JWT密钥等：

```env
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/idle_game"

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run generate

# 运行数据库迁移
npm run migrate
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 5. 构建生产版本

```bash
npm run build
npm start
```

## 📡 API 文档

### 认证相关

#### POST /api/auth/login
用户登录，获取 JWT token。

**请求体：**
```json
{
  "phone": "13800138000",
  "code": "123456",
  "deviceId": "unique-device-id"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "userId": "u_123",
    "needKYC": false
  }
}
```

### 用户相关

#### GET /api/user/profile
获取用户信息（需要认证）。

**Headers：**
```
Authorization: Bearer <jwt-token>
```

### 星宠相关

#### GET /api/pet/list
获取用户的星宠列表（需要认证）。

#### POST /api/pet/levelup
星宠升级（需要认证）。

### 挂机系统

#### POST /api/afk/start
开启挂机（需要认证）。

#### POST /api/afk/claim
领取挂机收益（需要认证）。

#### GET /api/afk/status
获取挂机状态（需要认证）。

更多 API 详情请参考各路由文件中的注释。

## 🔧 开发指南

### 添加新的 API 接口

1. 在 `src/routes/` 中添加或修改路由文件
2. 在 `src/controllers/` 中创建控制器处理业务逻辑
3. 在 `src/services/` 中实现具体的服务层逻辑
4. 在 `src/models/` 中定义 Prisma 数据模型

### 数据库操作

```bash
# 创建新的迁移
npx prisma migrate dev --name migration_name

# 重置数据库
npx prisma migrate reset

# 打开 Prisma Studio（可视化数据库管理）
npm run studio
```

### 日志管理

项目使用 Winston 进行日志管理，日志文件保存在 `logs/` 目录：

- `combined.log` - 所有日志
- `error.log` - 错误日志

### 定时任务

定时任务在 `src/utils/cron.ts` 中定义，包括：

- 每日任务重置（每天0点）
- 能量自然恢复（每分钟）
- 挂机收益结算（每分钟）
- 矿点挑战结算（每分钟）
- 数据清理（每天凌晨3点）
- 全平台产出监控（每小时）

## 🔒 安全特性

- **JWT 认证** - 所有敏感接口需要有效 token
- **设备绑定** - 防止账号共享
- **限流保护** - 防止 API 滥用
- **参数验证** - 使用 Zod 进行输入验证
- **SQL 注入防护** - Prisma ORM 自动防护
- **XSS 防护** - Helmet 中间件保护
- **CORS 配置** - 限制跨域访问

## 📊 监控与运维

### 健康检查

```bash
GET /health
```

### 日志查看

```bash
# 查看实时日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log
```

### 性能监控

在生产环境中，建议使用以下工具：

- **PM2** - 进程管理
- **Prometheus** - 指标收集
- **Grafana** - 可视化监控
- **ELK Stack** - 日志分析

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

## 📦 部署

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t idle-game-backend .

# 运行容器
docker run -d -p 3000:3000 --env-file .env idle-game-backend
```

### 传统部署

```bash
# 安装 PM2
npm install -g pm2

# 构建项目
npm run build

# 使用 PM2 启动
pm2 start dist/app.js --name idle-game-backend

# 查看状态
pm2 status

# 查看日志
pm2 logs idle-game-backend
```

## 🐛 故障排查

### 数据库连接失败

检查 `DATABASE_URL` 配置是否正确，确保 PostgreSQL 服务正在运行。

### Redis 连接失败

检查 Redis 服务是否启动：

```bash
redis-cli ping
```

### JWT 验证失败

确保 `JWT_SECRET` 配置正确，且 token 未过期。

## 📝 待办事项

- [ ] 完善所有路由的业务逻辑实现
- [ ] 添加 Prisma 数据库模型定义
- [ ] 实现经济系统核心算法
- [ ] 添加单元测试和集成测试
- [ ] 实现 WebSocket 实时通知
- [ ] 添加 Redis 缓存层
- [ ] 完善 API 文档（Swagger）
- [ ] 实现支付接口对接
- [ ] 添加数据备份策略
- [ ] 性能优化和压力测试

## 📚 相关文档

- [Node.js 文档](https://nodejs.org/)
- [Express 文档](https://expressjs.com/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Prisma 文档](https://www.prisma.io/)
- [JWT 文档](https://jwt.io/)
- [Winston 文档](https://github.com/winstonjs/winston)

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**当前状态：** 🚧 开发中

**版本：** 1.0.0

