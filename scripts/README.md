# 🔧 部署脚本说明

本目录包含项目的自动化部署脚本。

---

## 📜 脚本列表

### 1. `deploy-docker.sh` - Docker 一键部署

**功能**: 使用 Docker Compose 部署整个应用栈

**使用方法**:

```bash
# Linux/Mac 用户（需要执行权限）
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh [command]

# Windows 用户（使用 Git Bash 或 WSL2）
bash scripts/deploy-docker.sh [command]
```

**可用命令**:

- `init` - 初始化环境配置（自动生成 .env 文件）
- `start` - 启动所有服务
- `stop` - 停止所有服务
- `restart` - 重启所有服务
- `logs` - 查看服务日志
- `clean` - 清理所有数据（谨慎使用）

**示例**:

```bash
# 首次部署
./scripts/deploy-docker.sh init
./scripts/deploy-docker.sh start

# 查看日志
./scripts/deploy-docker.sh logs

# 重启服务
./scripts/deploy-docker.sh restart
```

---

### 2. `deploy-production.sh` - 生产环境部署（PM2）

**功能**: 使用 PM2 部署后端服务到生产环境

**使用方法**:

```bash
# Linux/Mac 用户
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh [command]

# Windows 用户（推荐使用 Docker 方式）
bash scripts/deploy-production.sh [command]
```

**可用命令**:

- `install` - 安装项目依赖并构建
- `start` - 启动服务（PM2 集群模式）
- `stop` - 停止服务
- `restart` - 重启服务
- `status` - 查看服务状态
- `update` - 更新部署（拉取代码、构建、重启）

**示例**:

```bash
# 首次部署
./scripts/deploy-production.sh install
./scripts/deploy-production.sh start

# 查看状态
./scripts/deploy-production.sh status

# 更新部署
./scripts/deploy-production.sh update
```

---

### 3. `init-database.sh` - 数据库初始化

**功能**: 创建数据库并运行 Prisma 迁移

**使用方法**:

```bash
# Linux/Mac 用户
chmod +x scripts/init-database.sh
./scripts/init-database.sh

# Windows 用户
bash scripts/init-database.sh
```

**功能**:

- 测试数据库连接
- 创建数据库（如果不存在）
- 运行 Prisma 数据库迁移
- 可选的重建数据库

---

## 🎯 快速开始

### Docker 部署（推荐）

```bash
# 1. 初始化
./scripts/deploy-docker.sh init

# 2. 启动
./scripts/deploy-docker.sh start

# 3. 验证
curl http://localhost:3000/health
```

### 生产环境部署

```bash
# 1. 安装
./scripts/deploy-production.sh install

# 2. 配置环境变量
cd idle-game-backend
nano .env

# 3. 启动
cd ..
./scripts/deploy-production.sh start

# 4. 验证
pm2 status
```

---

## 📋 系统要求

### Docker 部署

- Docker 20.10+
- Docker Compose 2.0+
- 磁盘空间 2GB+

### 生产环境部署

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- PM2（自动安装）
- 磁盘空间 1GB+

---

## ⚠️ 注意事项

### Windows 用户

1. **推荐使用 Docker Desktop**
2. 或者使用 WSL2 + Docker
3. 或者使用 Git Bash 运行脚本

### Linux/Mac 用户

1. **需要执行权限**: `chmod +x scripts/*.sh`
2. 某些命令可能需要 sudo 权限
3. 确保防火墙允许相应端口

### 生产环境

1. **修改默认密码**: 生产环境必须修改所有默认密码
2. **配置 HTTPS**: 使用 Nginx 配置 SSL 证书
3. **定期备份**: 设置数据库自动备份
4. **监控告警**: 配置监控和告警系统

---

## 🔍 故障排查

### 脚本执行失败

```bash
# 检查 Docker 是否运行
docker --version
docker-compose --version

# 检查端口占用
lsof -i :3000
lsof -i :5432
lsof -i :6379

# 查看详细错误
./scripts/deploy-docker.sh start
# 或
docker-compose logs
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 测试连接
psql -h localhost -U idlegame -d idle_game

# 查看 Docker 日志
docker-compose logs postgres
```

### PM2 服务无法启动

```bash
# 查看 PM2 日志
pm2 logs idle-game-backend

# 查看详细错误
pm2 describe idle-game-backend

# 重启服务
pm2 restart idle-game-backend
```

---

## 📚 相关文档

- [快速部署指南](../DEPLOY_QUICK_START.md)
- [完整部署文档](../docs/DEPLOYMENT.md)
- [部署完成总结](../docs/DEPLOYMENT_COMPLETE.md)

---

## 💡 提示

- 脚本会自动检查依赖和环境
- 首次运行可能需要下载镜像，请耐心等待
- 生产环境部署前请仔细阅读安全配置
- 遇到问题请查看日志文件

---

**最后更新**: 2025-10-11  
**维护人员**: 开发团队

