# 📦 星宠挂机游戏 - 完整部署文档

> **版本**: 2.0.0  
> **更新时间**: 2025-10-11  
> **适用环境**: Docker / PM2 / 手动部署

---

## 📋 目录

- [快速开始](#-快速开始)
  - [Docker 本地部署](#docker-本地部署)
  - [服务器部署](#服务器部署)
  - [生产环境部署](#生产环境部署)
- [部署架构](#-部署架构)
- [环境要求](#-环境要求)
- [详细部署步骤](#-详细部署步骤)
  - [方式一：Docker Compose](#方式一docker-compose-推荐)
  - [方式二：PM2 生产部署](#方式二pm2-生产部署)
  - [方式三：手动部署](#方式三手动部署)
- [服务器自动化部署](#-服务器自动化部署)
- [环境变量配置](#-环境变量配置)
- [初始化数据](#-初始化数据)
- [部署后管理](#-部署后管理)
- [监控与日志](#-监控与日志)
- [安全加固](#-安全加固)
- [性能优化](#-性能优化)
- [故障排查](#-故障排查)
- [常见问题](#-常见问题)

---

## 🚀 快速开始

### Docker 本地部署

**适合**: 开发、测试、快速体验

```bash
# 1. 初始化配置（自动生成密钥）
bash scripts/deploy-docker.sh init

# 2. 启动所有服务
bash scripts/deploy-docker.sh start

# 3. 验证
curl http://localhost:3000/health
```

**完成时间**: 5-10 分钟

---

### 服务器部署

**适合**: 云服务器、VPS

**服务器信息示例**:
- 地址: 43.130.44.169
- 用户: root
- 系统: Ubuntu 20.04+

#### Windows 用户

```bash
# 使用 Git Bash
cd /d/Projects/小游戏

# 1. 配置 SSH 密钥
bash scripts/setup-ssh-key.sh

# 2. 一键部署
bash scripts/deploy-to-server.sh deploy

# 3. 验证
curl http://43.130.44.169:3000/health
```

#### Linux/Mac 用户

```bash
# 1. 赋予执行权限
chmod +x scripts/*.sh

# 2. 配置 SSH
./scripts/setup-ssh-key.sh

# 3. 一键部署
./scripts/deploy-to-server.sh deploy
```

**完成时间**: 10-15 分钟

---

### 生产环境部署

**适合**: 生产环境、大规模部署

```bash
# 1. 安装项目依赖
bash scripts/deploy-production.sh install

# 2. 配置环境变量
cd idle-game-backend
cp config.example.env .env
nano .env  # 修改配置

# 3. 启动服务（PM2 集群模式）
cd ..
bash scripts/deploy-production.sh start
```

**完成时间**: 15-20 分钟

---

## 🏗️ 部署架构

### 推荐架构

```
┌─────────────────────────────────────────────────┐
│                   用户客户端                      │
│         (Web浏览器 / Android / iOS)              │
└─────────────────┬───────────────────────────────┘
                  │
                  ├─────────────────────────────┐
                  │                             │
          ┌───────▼───────┐           ┌────────▼──────────┐
          │  CDN / Nginx  │           │   反向代理/负载均衡  │
          │  (静态资源)    │           │     (Nginx)        │
          └───────────────┘           └────────┬───────────┘
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                    ┌─────────▼──────┐  ┌──────▼────────┐  ┌──▼─────┐
                    │  后端服务 #1    │  │  后端服务 #2   │  │  ...   │
                    │   (Node.js)    │  │   (Node.js)   │  │        │
                    └─────────┬──────┘  └──────┬────────┘  └────────┘
                              │                │
                              └────────┬───────┘
                                       │
                      ┌────────────────┼───────────────────┐
                      │                │                   │
            ┌─────────▼────────┐  ┌────▼────────┐  ┌──────▼───────┐
            │   PostgreSQL     │  │   Redis     │  │  文件存储     │
            │   (主数据库)      │  │   (缓存)    │  │   (OSS/S3)   │
            └──────────────────┘  └─────────────┘  └──────────────┘
```

---

## 💻 环境要求

### 开发环境

- **Node.js**: 18+ (推荐 18 LTS)
- **PostgreSQL**: 14+
- **Redis**: 7+ (可选)
- **Docker**: 20.10+ (如果使用 Docker)
- **Docker Compose**: 2.0+ (如果使用 Docker)

### 生产环境

- **服务器**: 2核4GB 起步（推荐 4核8GB）
- **磁盘**: 20GB+ 可用空间
- **系统**: Ubuntu 20.04+, CentOS 7+, Debian 10+
- **网络**: 公网 IP，开放 80/443/3000 端口

---

## 📝 详细部署步骤

### 方式一：Docker Compose (推荐)

适合：开发、测试、小型生产环境

#### 1. 准备工作

```bash
# 检查 Docker 环境
docker --version
docker-compose --version

# 如果未安装，执行：
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# macOS
brew install docker docker-compose
```

#### 2. 初始化配置

```bash
# 使用自动化脚本（推荐）
bash scripts/deploy-docker.sh init

# 或手动创建 .env 文件
cat > .env <<EOF
POSTGRES_USER=idlegame
POSTGRES_PASSWORD=$(openssl rand -base64 16)
POSTGRES_DB=idle_game
POSTGRES_PORT=5432

REDIS_PASSWORD=$(openssl rand -base64 16)
REDIS_PORT=6379

NODE_ENV=production
PORT=3000
HOST=0.0.0.0
BACKEND_PORT=3000

JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_EXPIRES_IN=30d

ENCRYPTION_KEY=$(openssl rand -base64 24)

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

LOG_LEVEL=info
LOG_MAX_FILES=7d

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF
```

#### 3. 启动服务

```bash
# 使用自动化脚本
bash scripts/deploy-docker.sh start

# 或手动执行
docker-compose up -d --build

# 查看日志
docker-compose logs -f backend
```

#### 4. 运行数据库迁移

```bash
# 等待服务启动（约 15 秒）
sleep 15

# 运行迁移
docker-compose exec backend npx prisma migrate deploy
```

#### 5. 验证部署

```bash
# 查看容器状态
docker-compose ps

# 测试健康检查
curl http://localhost:3000/health

# 预期响应：
# {"status":"ok","timestamp":"...","uptime":...}
```

#### 管理命令

```bash
# 查看日志
bash scripts/deploy-docker.sh logs
# 或
docker-compose logs -f backend

# 重启服务
bash scripts/deploy-docker.sh restart
# 或
docker-compose restart

# 停止服务
bash scripts/deploy-docker.sh stop
# 或
docker-compose down

# 清理所有数据（谨慎）
bash scripts/deploy-docker.sh clean
# 或
docker-compose down -v --rmi all
```

---

### 方式二：PM2 生产部署

适合：有完整服务器控制权的生产环境

#### 1. 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y curl wget git

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 安装 Redis
sudo apt-get install -y redis-server

# 安装 PM2
sudo npm install -g pm2

# 验证安装
node --version    # v18.x.x
npm --version     # 9.x.x
pm2 --version     # 5.x.x
psql --version    # PostgreSQL 14+
redis-cli --version  # redis-cli 7+
```

#### 2. 配置数据库

```bash
# 创建数据库用户和数据库
sudo -u postgres psql <<EOF
CREATE USER idlegame WITH PASSWORD 'your_strong_password';
CREATE DATABASE idle_game OWNER idlegame;
GRANT ALL PRIVILEGES ON DATABASE idle_game TO idlegame;
\q
EOF

# 或使用初始化脚本
bash scripts/init-database.sh
```

#### 3. 部署后端

```bash
# 使用自动化脚本（推荐）
bash scripts/deploy-production.sh install

# 或手动执行：
cd idle-game-backend

# 安装依赖
npm ci --only=production

# 配置环境变量
cp config.example.env .env
nano .env  # 编辑配置

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 构建项目
npm run build

# 使用 PM2 启动（集群模式）
pm2 start dist/app.js \
  --name idle-game-backend \
  --instances 2 \
  --exec-mode cluster \
  --max-memory-restart 500M \
  --time

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

#### 4. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt-get install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/idle-game
```

```nginx
# 后端 API 代理
upstream backend {
    least_conn;
    server 127.0.0.1:3000;
}

# HTTP 服务器
server {
    listen 80;
    server_name your-domain.com;

    # 后端 API 代理
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/idle-game /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载
sudo systemctl reload nginx
```

#### 管理命令

```bash
# 查看状态
bash scripts/deploy-production.sh status
# 或
pm2 status

# 查看日志
pm2 logs idle-game-backend

# 查看监控
pm2 monit

# 重启服务
bash scripts/deploy-production.sh restart
# 或
pm2 restart idle-game-backend

# 停止服务
bash scripts/deploy-production.sh stop
# 或
pm2 stop idle-game-backend

# 更新部署
bash scripts/deploy-production.sh update
```

---

### 方式三：手动部署

适合：特殊需求、自定义配置

#### 后端部署

```bash
cd idle-game-backend

# 1. 安装依赖
npm install --production

# 2. 配置环境变量
cp config.example.env .env
# 编辑 .env 文件，配置数据库连接等

# 3. 生成 Prisma Client
npx prisma generate

# 4. 运行数据库迁移
npx prisma migrate deploy

# 5. 构建项目
npm run build

# 6. 启动服务
node dist/app.js

# 或使用 PM2
pm2 start dist/app.js --name idle-game-backend
```

---

## 🌐 服务器自动化部署

### 自动化部署脚本

项目提供了完整的自动化部署脚本，支持一键部署到远程服务器。

#### 脚本列表

1. **`scripts/deploy-to-server.sh`** - 服务器一键部署
2. **`scripts/setup-ssh-key.sh`** - SSH 密钥配置
3. **`scripts/deploy-docker.sh`** - Docker 本地部署
4. **`scripts/deploy-production.sh`** - PM2 生产部署
5. **`scripts/init-database.sh`** - 数据库初始化

#### 使用 deploy-to-server.sh

**功能**: 自动部署到远程服务器

```bash
# 修改服务器信息（在脚本中）
SERVER_HOST="43.130.44.169"
SERVER_USER="root"

# 1. 配置 SSH 密钥（首次）
bash scripts/setup-ssh-key.sh

# 2. 一键部署
bash scripts/deploy-to-server.sh deploy

# 3. 查看状态
bash scripts/deploy-to-server.sh status

# 4. 查看日志
bash scripts/deploy-to-server.sh logs

# 5. 重启服务
bash scripts/deploy-to-server.sh restart
```

**脚本会自动完成**:
- ✅ 检查 SSH 连接
- ✅ 检查并安装 Docker/Docker Compose
- ✅ 创建部署目录
- ✅ 上传项目文件
- ✅ 生成随机密钥和环境配置
- ✅ 构建并启动容器
- ✅ 运行数据库迁移
- ✅ 配置防火墙
- ✅ 健康检查

---

## ⚙️ 环境变量配置

### 必需配置

```bash
# 数据库连接
DATABASE_URL=postgresql://user:password@localhost:5432/idle_game?schema=public

# Redis 连接（可选）
REDIS_URL=redis://:password@localhost:6379

# JWT 密钥（至少 32 字符）
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# 加密密钥（32 字符）
ENCRYPTION_KEY=your-32-character-encryption-key!!
```

### 可选配置

```bash
# 服务器配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS 配置
ALLOWED_ORIGINS=https://your-domain.com

# 短信服务（生产环境）
SMS_ACCESS_KEY=your-sms-access-key
SMS_SECRET_KEY=your-sms-secret-key
SMS_SIGN_NAME=星宠挂机
SMS_TEMPLATE_CODE=SMS_123456

# 实名认证（生产环境）
KYC_API_KEY=your-kyc-api-key
KYC_API_SECRET=your-kyc-api-secret

# 日志配置
LOG_LEVEL=info
LOG_MAX_FILES=7d

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 生成随机密钥

```bash
# JWT 密钥
openssl rand -base64 32

# 加密密钥
openssl rand -base64 24

# 数据库密码
openssl rand -base64 16
```

---

## 💾 初始化数据

部署完成后，必须初始化游戏基础数据。

### 方式一：容器内执行（推荐）

```bash
# Docker 部署
docker-compose exec backend node -e "
require('./dist/services/shop.service.js').shopService.initializeShopItems().then(() => console.log('商店初始化完成'));
require('./dist/services/task.service.js').taskService.initializeTasks().then(() => console.log('任务初始化完成'));
"

# PM2 部署
cd idle-game-backend
node -e "
require('./dist/services/shop.service.js').shopService.initializeShopItems().then(() => console.log('商店初始化完成'));
require('./dist/services/task.service.js').taskService.initializeTasks().then(() => console.log('任务初始化完成'));
"
```

### 方式二：通过 API 调用

```bash
# 1. 先注册用户并登录获取 token
curl -X POST http://your-domain:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

curl -X POST http://your-domain:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'

# 2. 使用 token 初始化
curl -X POST http://your-domain:3000/api/shop/init \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X POST http://your-domain:3000/api/task/init \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔧 部署后管理

### Docker 方式

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis

# 重启服务
docker-compose restart

# 进入容器
docker-compose exec backend sh

# 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 停止服务
docker-compose down

# 重新启动
docker-compose up -d

# 查看资源使用
docker stats
```

### PM2 方式

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs idle-game-backend

# 查看监控
pm2 monit

# 重启服务
pm2 restart idle-game-backend

# 停止服务
pm2 stop idle-game-backend

# 删除服务
pm2 delete idle-game-backend

# 查看详细信息
pm2 describe idle-game-backend
```

### 数据备份

```bash
# 备份数据库
# Docker 方式
docker-compose exec postgres pg_dump -U idlegame idle_game > backup_$(date +%Y%m%d).sql

# 手动方式
pg_dump -U idlegame idle_game > backup_$(date +%Y%m%d).sql

# 压缩备份
gzip backup_*.sql

# 恢复数据库
# Docker 方式
docker-compose exec -T postgres psql -U idlegame idle_game < backup.sql

# 手动方式
psql -U idlegame idle_game < backup.sql
```

### 自动备份脚本

```bash
# 创建备份脚本
cat > /opt/idle-game/backup.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T postgres pg_dump -U idlegame idle_game | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 删除 7 天前的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "备份完成: db_$DATE.sql.gz"
EOF

chmod +x /opt/idle-game/backup.sh

# 添加到 crontab（每天凌晨 2 点）
crontab -e
# 添加: 0 2 * * * /opt/idle-game/backup.sh
```

---

## 📊 监控与日志

### 应用监控

```bash
# PM2 监控
pm2 install pm2-server-monit
pm2 monit

# Docker 监控
docker stats

# 系统资源
htop  # 需要安装: apt-get install htop
```

### 日志管理

```bash
# PM2 日志
pm2 logs idle-game-backend

# 日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Docker 日志
docker-compose logs -f --tail=100 backend

# 查看 Winston 日志
tail -f logs/error.log
tail -f logs/combined.log
```

### 健康检查

```bash
# 健康检查接口
curl http://localhost:3000/health

# 响应示例
{
  "status": "ok",
  "timestamp": "2025-10-11T10:00:00.000Z",
  "uptime": 123.456
}

# 数据库连接测试
psql -U idlegame -d idle_game -c "SELECT 1"

# Redis 连接测试
redis-cli ping
```

---

## 🔒 安全加固

### 1. 防火墙配置

```bash
# Ubuntu/Debian
sudo apt-get install ufw

# 配置规则
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 2. 数据库安全

```bash
# 修改 PostgreSQL 配置
sudo nano /etc/postgresql/14/main/pg_hba.conf

# 只允许本地连接
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

### 3. HTTPS 配置

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 4. SSH 安全

```bash
# 禁用密码登录，只允许密钥认证
sudo nano /etc/ssh/sshd_config

# 修改配置
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password

# 重启 SSH
sudo systemctl restart sshd
```

### 5. 定期更新

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade

# 更新 Docker 镜像
docker-compose pull
docker-compose up -d

# 更新 npm 包
npm update
```

---

## ⚡ 性能优化

### 1. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_pets_user_id ON pets(user_id);
CREATE INDEX idx_production_logs_user_id ON production_logs(user_id);
CREATE INDEX idx_production_logs_created_at ON production_logs(created_at);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- 定期清理旧数据
DELETE FROM production_logs WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM transactions WHERE created_at < NOW() - INTERVAL '180 days';

-- 分析和优化
ANALYZE;
VACUUM;
```

### 2. Redis 缓存

```javascript
// 缓存策略示例
// - 用户信息：TTL 30 分钟
// - 星宠列表：TTL 10 分钟
// - 商品列表：TTL 5 分钟
// - 游戏配置：TTL 1 小时
```

### 3. PM2 集群模式

```bash
# 启动多个实例（根据 CPU 核心数）
pm2 start dist/app.js \
  --name idle-game-backend \
  --instances max \
  --exec-mode cluster
```

### 4. Nginx 优化

```nginx
# 启用 Gzip 压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/json application/xml+rss;

# 启用缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}

# 连接池
upstream backend {
    least_conn;
    keepalive 32;
    server 127.0.0.1:3000;
}
```

### 5. 负载均衡

```nginx
# 多后端实例
upstream backend {
    least_conn;
    server backend1.example.com:3000 weight=3;
    server backend2.example.com:3000 weight=2;
    server backend3.example.com:3000 weight=1 backup;
}
```

---

## 🔍 故障排查

### 后端服务无法启动

```bash
# 1. 查看日志
pm2 logs idle-game-backend
# 或
docker-compose logs backend

# 2. 检查端口占用
lsof -i :3000

# 3. 检查环境变量
env | grep DATABASE_URL

# 4. 测试数据库连接
psql -h localhost -U idlegame -d idle_game
```

### 数据库连接失败

```bash
# 1. 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 2. 查看日志
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# 3. 测试连接
psql -h localhost -U idlegame -d idle_game

# 4. 检查防火墙
sudo ufw status
```

### 容器无法启动

```bash
# 1. 查看详细日志
docker-compose logs

# 2. 检查磁盘空间
df -h

# 3. 清理 Docker
docker system prune -a

# 4. 重新构建
docker-compose down
docker-compose up -d --build --force-recreate
```

### 性能问题

```bash
# 1. 查看系统资源
htop

# 2. 查看 Node.js 进程
pm2 monit

# 3. 分析慢查询
# 在 PostgreSQL 中启用慢查询日志
log_min_duration_statement = 100

# 4. 查看数据库连接
SELECT * FROM pg_stat_activity;
```

### API 响应慢

```bash
# 1. 检查数据库查询性能
EXPLAIN ANALYZE SELECT * FROM users WHERE phone = '13800138000';

# 2. 检查 Redis 连接
redis-cli ping

# 3. 查看网络延迟
ping your-server-ip

# 4. 分析日志
grep "slow" logs/combined.log
```

---

## ❓ 常见问题

### Q1: Docker 容器无法访问外网？

**A**: 检查 Docker 网络配置
```bash
docker network inspect idle-game-network
sudo systemctl restart docker
```

### Q2: 数据库迁移失败？

**A**: 手动运行迁移
```bash
docker-compose exec backend npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### Q3: 端口被占用？

**A**: 修改端口或停止占用进程
```bash
# 查找占用进程
lsof -i :3000

# 停止进程
kill -9 <PID>

# 或修改 docker-compose.yml 中的端口映射
```

### Q4: Windows 下无法运行 .sh 脚本？

**A**: 使用 Git Bash 或 WSL2
```bash
# Git Bash
bash scripts/deploy-docker.sh init

# WSL2
./scripts/deploy-docker.sh init
```

### Q5: 如何更新部署？

**A**: 
```bash
# 拉取最新代码
git pull

# Docker 方式
docker-compose up -d --build

# PM2 方式
bash scripts/deploy-production.sh update
```

### Q6: 忘记了 .env 中的密码？

**A**: 
```bash
# SSH 到服务器
ssh root@your-server

# 查看配置
cat /opt/idle-game/.env
```

### Q7: 如何查看实时日志？

**A**: 
```bash
# Docker
docker-compose logs -f backend

# PM2
pm2 logs idle-game-backend --lines 100
```

---

## 📚 相关文档

- [快速开始指南](./docs/QUICK_START.md) - 开发环境搭建
- [第一阶段完成总结](./docs/PHASE_ONE_COMPLETION.md) - 功能清单
- [项目文档](./README.md) - 项目概览

---

## 📝 部署检查清单

### 部署前

- [ ] Node.js 18+ 已安装
- [ ] PostgreSQL 14+ 已安装并运行
- [ ] Redis 7+ 已安装并运行（可选）
- [ ] 环境变量已正确配置
- [ ] 数据库连接可用
- [ ] JWT 密钥已修改（生产环境）
- [ ] 加密密钥已修改（生产环境）
- [ ] CORS 允许的域名已配置

### 部署后

- [ ] 健康检查接口返回正常 (`/health`)
- [ ] API 接口可正常访问
- [ ] 数据库迁移已完成
- [ ] 基础数据已初始化（商店、任务）
- [ ] 日志正常记录
- [ ] 定时任务正常运行
- [ ] 防火墙规则已配置
- [ ] 备份策略已设置
- [ ] 监控告警已配置

---

## 🎊 总结

本文档涵盖了星宠挂机游戏的所有部署方式：

✅ **3 种部署方式**: Docker / PM2 / 手动  
✅ **完整的部署流程**: 从准备到验证  
✅ **自动化脚本**: 一键部署到服务器  
✅ **详细的配置说明**: 环境变量、数据库、安全  
✅ **运维管理指南**: 监控、日志、备份  
✅ **故障排查方案**: 常见问题和解决方法  

**选择适合你的部署方式**：

- 🚀 **快速体验**: Docker 本地部署
- 🌐 **服务器部署**: 自动化脚本一键部署
- 💪 **生产环境**: PM2 集群模式 + Nginx

**开始部署你的星宠挂机游戏吧！** 🎮

---

**文档版本**: 2.0.0  
**最后更新**: 2025-10-11  
**维护人员**: 开发团队

