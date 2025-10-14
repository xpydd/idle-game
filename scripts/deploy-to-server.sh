#!/bin/bash

# 星宠挂机游戏 - 服务器部署脚本（Docker 方式）
# 使用方法: ./scripts/deploy-to-server.sh [deploy|status|logs|restart]

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

# 服务器配置
SERVER_HOST="43.130.44.169"
SERVER_USER="root"
SERVER_PORT="22"
DEPLOY_DIR="/opt/idle-game"
PROJECT_NAME="idle-game"

# 检查是否配置了 SSH 密钥
check_ssh_key() {
    print_step "检查 SSH 连接..."
    
    # 尝试使用密钥连接
    if ssh -o BatchMode=yes -o ConnectTimeout=5 ${SERVER_USER}@${SERVER_HOST} "echo 'SSH连接成功'" 2>/dev/null; then
        print_info "SSH 密钥认证成功 ✓"
        USE_PASSWORD=false
    else
        print_warning "SSH 密钥认证失败，将使用密码认证"
        print_info "建议配置 SSH 密钥以提高安全性和便利性"
        USE_PASSWORD=true
    fi
}

# 检查本地环境
check_local_env() {
    print_step "检查本地环境..."
    
    # 检查必要的文件
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml 不存在！"
        exit 1
    fi
    
    if [ ! -f "idle-game-backend/Dockerfile" ]; then
        print_error "Dockerfile 不存在！"
        exit 1
    fi
    
    print_info "本地环境检查通过 ✓"
}

# 检查服务器环境
check_server_env() {
    print_step "检查服务器环境..."
    
    # 检查 Docker
    if ssh ${SERVER_USER}@${SERVER_HOST} "command -v docker" &>/dev/null; then
        DOCKER_VERSION=$(ssh ${SERVER_USER}@${SERVER_HOST} "docker --version")
        print_info "Docker 已安装: $DOCKER_VERSION ✓"
    else
        print_warning "Docker 未安装，正在安装..."
        install_docker
    fi
    
    # 检查 Docker Compose
    if ssh ${SERVER_USER}@${SERVER_HOST} "command -v docker-compose" &>/dev/null || \
       ssh ${SERVER_USER}@${SERVER_HOST} "docker compose version" &>/dev/null; then
        print_info "Docker Compose 已安装 ✓"
    else
        print_warning "Docker Compose 未安装，正在安装..."
        install_docker_compose
    fi
}

# 安装 Docker
install_docker() {
    print_info "在服务器上安装 Docker..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        # 更新软件包
        apt-get update
        
        # 安装必要的依赖
        apt-get install -y apt-transport-https ca-certificates curl software-properties-common
        
        # 添加 Docker 官方 GPG 密钥
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
        
        # 添加 Docker 仓库
        add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
        
        # 安装 Docker
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io
        
        # 启动 Docker
        systemctl start docker
        systemctl enable docker
        
        echo "Docker 安装完成"
EOF
    
    print_info "Docker 安装成功 ✓"
}

# 安装 Docker Compose
install_docker_compose() {
    print_info "在服务器上安装 Docker Compose..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        # 下载 Docker Compose
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        
        # 添加执行权限
        chmod +x /usr/local/bin/docker-compose
        
        # 创建软链接
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        
        echo "Docker Compose 安装完成"
EOF
    
    print_info "Docker Compose 安装成功 ✓"
}

# 创建部署目录
create_deploy_dir() {
    print_step "创建部署目录..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << EOF
        # 创建部署目录
        mkdir -p ${DEPLOY_DIR}
        mkdir -p ${DEPLOY_DIR}/logs
        mkdir -p ${DEPLOY_DIR}/nginx/conf.d
        mkdir -p ${DEPLOY_DIR}/nginx/ssl
        
        echo "部署目录创建完成"
EOF
    
    print_info "部署目录创建成功 ✓"
}

# 上传项目文件
upload_files() {
    print_step "上传项目文件到服务器..."
    
    # 创建临时打包目录
    print_info "准备项目文件..."
    TEMP_DIR=$(mktemp -d)
    
    # 复制必要的文件
    cp docker-compose.yml ${TEMP_DIR}/
    cp -r idle-game-backend ${TEMP_DIR}/
    
    # 排除不必要的文件
    rm -rf ${TEMP_DIR}/idle-game-backend/node_modules
    rm -rf ${TEMP_DIR}/idle-game-backend/dist
    rm -rf ${TEMP_DIR}/idle-game-backend/.env
    
    # 上传到服务器
    print_info "上传文件到服务器..."
    scp -r ${TEMP_DIR}/* ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_DIR}/
    
    # 清理临时目录
    rm -rf ${TEMP_DIR}
    
    print_info "文件上传成功 ✓"
}

# 生成环境配置
generate_env() {
    print_step "生成环境配置..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        cd /opt/idle-game
        
        # 生成随机密钥
        JWT_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        ENCRYPTION_KEY=$(openssl rand -base64 24)
        POSTGRES_PASSWORD=$(openssl rand -base64 16)
        REDIS_PASSWORD=$(openssl rand -base64 16)
        
        # 创建 .env 文件
        cat > .env <<ENVFILE
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
ALLOWED_ORIGINS=http://43.130.44.169:3000,http://43.130.44.169

# 日志配置
LOG_LEVEL=info
LOG_MAX_FILES=7d

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
ENVFILE
        
        echo "环境配置生成完成"
EOF
    
    print_info "环境配置生成成功 ✓"
}

# 部署应用
deploy_app() {
    print_step "部署应用..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        cd /opt/idle-game
        
        # 停止旧容器
        echo "停止旧容器..."
        docker-compose down || true
        
        # 构建并启动新容器
        echo "构建并启动容器..."
        docker-compose up -d --build
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 15
        
        # 运行数据库迁移
        echo "运行数据库迁移..."
        docker-compose exec -T backend npx prisma migrate deploy || echo "迁移失败，请手动检查"
        
        echo "应用部署完成"
EOF
    
    print_info "应用部署成功 ✓"
}

# 检查服务状态
check_status() {
    print_step "检查服务状态..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        cd /opt/idle-game
        
        echo "==================================="
        echo "容器状态："
        echo "==================================="
        docker-compose ps
        
        echo ""
        echo "==================================="
        echo "健康检查："
        echo "==================================="
        
        # 等待服务完全启动
        sleep 3
        
        # 检查后端健康
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            echo "✓ 后端服务正常"
        else
            echo "✗ 后端服务异常"
        fi
        
        # 检查数据库
        if docker-compose exec -T postgres pg_isready -U idlegame >/dev/null 2>&1; then
            echo "✓ 数据库连接正常"
        else
            echo "✗ 数据库连接异常"
        fi
        
        # 检查 Redis
        if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
            echo "✓ Redis 连接正常"
        else
            echo "✗ Redis 连接异常"
        fi
EOF
}

# 查看日志
view_logs() {
    print_step "查看服务日志..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        cd /opt/idle-game
        docker-compose logs --tail=50 backend
EOF
}

# 重启服务
restart_service() {
    print_step "重启服务..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        cd /opt/idle-game
        docker-compose restart
EOF
    
    print_info "服务重启成功 ✓"
}

# 配置防火墙
configure_firewall() {
    print_step "配置防火墙..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        # 安装 ufw（如果未安装）
        if ! command -v ufw &> /dev/null; then
            apt-get update
            apt-get install -y ufw
        fi
        
        # 配置防火墙规则
        ufw allow 22/tcp    # SSH
        ufw allow 80/tcp    # HTTP
        ufw allow 443/tcp   # HTTPS
        ufw allow 3000/tcp  # 后端 API
        
        # 启用防火墙（如果尚未启用）
        echo "y" | ufw enable || true
        
        echo "防火墙配置完成"
EOF
    
    print_info "防火墙配置成功 ✓"
}

# 主函数 - 完整部署
full_deploy() {
    echo "========================================"
    echo "  星宠挂机游戏 - 服务器部署工具"
    echo "  目标服务器: ${SERVER_HOST}"
    echo "========================================"
    echo ""
    
    check_ssh_key
    check_local_env
    check_server_env
    create_deploy_dir
    upload_files
    generate_env
    deploy_app
    configure_firewall
    
    echo ""
    echo "========================================"
    print_info "🎉 部署完成！"
    echo "========================================"
    echo ""
    print_info "访问地址："
    echo "  - 后端 API: http://${SERVER_HOST}:3000"
    echo "  - 健康检查: http://${SERVER_HOST}:3000/health"
    echo ""
    print_info "常用命令："
    echo "  - 查看状态: ./scripts/deploy-to-server.sh status"
    echo "  - 查看日志: ./scripts/deploy-to-server.sh logs"
    echo "  - 重启服务: ./scripts/deploy-to-server.sh restart"
    echo ""
    print_warning "重要提示："
    echo "  1. 请记录生成的随机密码（在服务器 /opt/idle-game/.env 文件中）"
    echo "  2. 建议配置域名和 HTTPS 证书"
    echo "  3. 定期备份数据库"
    echo ""
    
    check_status
}

# 主入口
case "$1" in
    deploy)
        full_deploy
        ;;
    status)
        check_status
        ;;
    logs)
        view_logs
        ;;
    restart)
        restart_service
        ;;
    *)
        print_info "使用方法:"
        echo "  ./scripts/deploy-to-server.sh deploy   - 完整部署到服务器"
        echo "  ./scripts/deploy-to-server.sh status   - 查看服务状态"
        echo "  ./scripts/deploy-to-server.sh logs     - 查看服务日志"
        echo "  ./scripts/deploy-to-server.sh restart  - 重启服务"
        echo ""
        print_info "首次部署请执行："
        echo "  ./scripts/deploy-to-server.sh deploy"
        ;;
esac


