#!/bin/bash

# 星宠挂机游戏 - 生产环境部署脚本（PM2方式）
# 使用方法: ./scripts/deploy-production.sh [install|start|stop|restart|status]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_step "检查系统依赖..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装！请先安装 Node.js 18+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js 版本过低！需要 18+，当前版本：$(node -v)"
        exit 1
    fi
    print_info "Node.js 版本：$(node -v) ✓"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装！"
        exit 1
    fi
    print_info "npm 版本：$(npm -v) ✓"
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        print_warning "PM2 未安装，正在安装..."
        npm install -g pm2
    fi
    print_info "PM2 版本：$(pm2 -v) ✓"
    
    # 检查 PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL 未安装！请确保 PostgreSQL 已安装并运行"
    else
        print_info "PostgreSQL 已安装 ✓"
    fi
    
    # 检查 Redis
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis 未安装！请确保 Redis 已安装并运行"
    else
        print_info "Redis 已安装 ✓"
    fi
}

# 安装项目依赖
install_project() {
    print_step "安装项目依赖..."
    
    cd idle-game-backend
    
    # 安装依赖
    print_info "安装 npm 依赖..."
    npm ci --only=production
    
    # 检查 .env 文件
    if [ ! -f .env ]; then
        print_warning ".env 文件不存在！"
        if [ -f config.example.env ]; then
            print_info "复制示例配置文件..."
            cp config.example.env .env
            print_warning "请编辑 .env 文件并配置正确的数据库连接信息"
            print_warning "配置文件位置: idle-game-backend/.env"
            read -p "配置完成后按回车继续..."
        else
            print_error "找不到配置示例文件！"
            exit 1
        fi
    fi
    
    # 生成 Prisma Client
    print_info "生成 Prisma Client..."
    npx prisma generate
    
    # 数据库迁移
    print_info "运行数据库迁移..."
    npx prisma migrate deploy || {
        print_warning "数据库迁移失败，请检查数据库连接"
        exit 1
    }
    
    # 构建项目
    print_info "构建 TypeScript..."
    npm run build
    
    cd ..
    
    print_info "项目安装完成 ✓"
}

# 启动服务
start_service() {
    print_step "启动后端服务..."
    
    cd idle-game-backend
    
    # 使用 PM2 启动
    pm2 start dist/app.js \
        --name "idle-game-backend" \
        --time \
        --instances 2 \
        --exec-mode cluster \
        --max-memory-restart 500M \
        --error ../logs/error.log \
        --output ../logs/output.log
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启
    pm2 startup
    
    cd ..
    
    print_info "服务启动成功 ✓"
    print_info ""
    print_info "服务信息："
    pm2 list
    print_info ""
    print_info "查看日志: pm2 logs idle-game-backend"
    print_info "查看监控: pm2 monit"
}

# 停止服务
stop_service() {
    print_step "停止后端服务..."
    
    pm2 stop idle-game-backend || {
        print_warning "服务未运行或停止失败"
    }
    
    print_info "服务已停止 ✓"
}

# 重启服务
restart_service() {
    print_step "重启后端服务..."
    
    pm2 restart idle-game-backend || {
        print_error "重启失败，服务可能未运行"
        exit 1
    }
    
    print_info "服务已重启 ✓"
}

# 查看状态
check_status() {
    print_step "服务状态："
    pm2 list
    echo ""
    pm2 info idle-game-backend
}

# 更新部署
update_deployment() {
    print_step "更新部署..."
    
    # 拉取最新代码
    print_info "拉取最新代码..."
    git pull
    
    # 重新安装依赖和构建
    cd idle-game-backend
    print_info "更新依赖..."
    npm ci --only=production
    
    print_info "重新生成 Prisma Client..."
    npx prisma generate
    
    print_info "运行数据库迁移..."
    npx prisma migrate deploy
    
    print_info "重新构建..."
    npm run build
    
    cd ..
    
    # 重启服务
    print_info "重启服务..."
    pm2 restart idle-game-backend
    
    print_info "更新完成 ✓"
}

# 主函数
main() {
    echo "========================================"
    echo "  星宠挂机游戏 - 生产环境部署工具"
    echo "========================================"
    echo ""
    
    case "$1" in
        install)
            check_dependencies
            install_project
            ;;
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            check_status
            ;;
        update)
            update_deployment
            ;;
        *)
            print_info "使用方法:"
            echo "  ./scripts/deploy-production.sh install  - 安装项目依赖"
            echo "  ./scripts/deploy-production.sh start    - 启动服务"
            echo "  ./scripts/deploy-production.sh stop     - 停止服务"
            echo "  ./scripts/deploy-production.sh restart  - 重启服务"
            echo "  ./scripts/deploy-production.sh status   - 查看状态"
            echo "  ./scripts/deploy-production.sh update   - 更新部署"
            echo ""
            print_info "首次部署请执行："
            echo "  1. ./scripts/deploy-production.sh install"
            echo "  2. ./scripts/deploy-production.sh start"
            ;;
    esac
}

main "$@"

