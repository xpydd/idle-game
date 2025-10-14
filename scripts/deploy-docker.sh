#!/bin/bash

# 星宠挂机游戏 - Docker 快速部署脚本
# 使用方法: ./scripts/deploy-docker.sh [init|start|stop|restart|logs|clean]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 和 Docker Compose
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装！请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装！请先安装 Docker Compose"
        exit 1
    fi
    
    print_info "Docker 环境检查通过 ✓"
}

# 初始化环境
init_env() {
    print_info "开始初始化环境..."
    
    # 检查 .env 文件
    if [ ! -f .env ]; then
        print_warning ".env 文件不存在，正在创建..."
        
        # 生成随机密钥
        JWT_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        ENCRYPTION_KEY=$(openssl rand -base64 24)
        POSTGRES_PASSWORD=$(openssl rand -base64 16)
        REDIS_PASSWORD=$(openssl rand -base64 16)
        
        cat > .env <<EOF
# 数据库配置
POSTGRES_USER=idlegame
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=idle_game
POSTGRES_PORT=5432

# Redis 配置
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_PORT=6379

# 后端配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
BACKEND_PORT=3000

# JWT 配置
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=30d

# 加密配置
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# CORS 配置
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# 日志配置
LOG_LEVEL=info
LOG_MAX_FILES=7d

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF
        
        print_info ".env 文件已创建 ✓"
        print_warning "请根据需要修改 .env 文件中的配置"
    else
        print_info ".env 文件已存在 ✓"
    fi
    
    # 创建日志目录
    mkdir -p logs
    print_info "日志目录已创建 ✓"
    
    print_info "环境初始化完成 ✓"
}

# 构建并启动服务
start_services() {
    print_info "开始构建并启动服务..."
    
    docker-compose up -d --build
    
    print_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        print_info "服务启动成功 ✓"
        print_info "正在运行数据库迁移..."
        
        # 运行数据库迁移
        docker-compose exec -T backend sh -c "npx prisma migrate deploy" || {
            print_warning "数据库迁移失败，可能需要手动执行"
        }
        
        print_info "部署完成 ✓"
        print_info ""
        print_info "访问地址："
        print_info "  - 后端 API: http://localhost:3000"
        print_info "  - 健康检查: http://localhost:3000/health"
        print_info ""
        print_info "查看日志: docker-compose logs -f backend"
        print_info "停止服务: docker-compose down"
    else
        print_error "服务启动失败，请查看日志：docker-compose logs"
        exit 1
    fi
}

# 停止服务
stop_services() {
    print_info "停止服务..."
    docker-compose down
    print_info "服务已停止 ✓"
}

# 重启服务
restart_services() {
    print_info "重启服务..."
    docker-compose restart
    print_info "服务已重启 ✓"
}

# 查看日志
view_logs() {
    print_info "查看服务日志（按 Ctrl+C 退出）..."
    docker-compose logs -f backend
}

# 清理所有数据
clean_all() {
    print_warning "此操作将删除所有容器、镜像和数据卷！"
    read -p "确定要继续吗？(yes/no): " confirm
    
    if [ "$confirm" == "yes" ]; then
        print_info "清理所有数据..."
        docker-compose down -v --rmi all
        print_info "清理完成 ✓"
    else
        print_info "已取消清理操作"
    fi
}

# 主函数
main() {
    echo "================================"
    echo "  星宠挂机游戏 - Docker 部署工具"
    echo "================================"
    echo ""
    
    check_docker
    
    case "$1" in
        init)
            init_env
            ;;
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            view_logs
            ;;
        clean)
            clean_all
            ;;
        *)
            print_info "使用方法:"
            echo "  ./scripts/deploy-docker.sh init     - 初始化环境配置"
            echo "  ./scripts/deploy-docker.sh start    - 启动所有服务"
            echo "  ./scripts/deploy-docker.sh stop     - 停止所有服务"
            echo "  ./scripts/deploy-docker.sh restart  - 重启所有服务"
            echo "  ./scripts/deploy-docker.sh logs     - 查看日志"
            echo "  ./scripts/deploy-docker.sh clean    - 清理所有数据"
            echo ""
            print_info "首次部署请执行："
            echo "  1. ./scripts/deploy-docker.sh init"
            echo "  2. ./scripts/deploy-docker.sh start"
            ;;
    esac
}

main "$@"

