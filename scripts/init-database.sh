#!/bin/bash

# 数据库初始化脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 数据库配置（从 .env 读取或使用默认值）
DB_USER=${POSTGRES_USER:-idlegame}
DB_PASSWORD=${POSTGRES_PASSWORD:-idlegame123}
DB_NAME=${POSTGRES_DB:-idle_game}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

print_info "数据库初始化工具"
echo ""
echo "数据库配置："
echo "  - 主机: $DB_HOST:$DB_PORT"
echo "  - 数据库: $DB_NAME"
echo "  - 用户: $DB_USER"
echo ""

# 测试数据库连接
print_info "测试数据库连接..."
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    print_info "数据库连接成功 ✓"
else
    print_error "数据库连接失败！请检查配置和数据库服务状态"
    exit 1
fi

# 创建数据库（如果不存在）
print_info "检查数据库是否存在..."
DB_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [ "$DB_EXISTS" = "1" ]; then
    print_warning "数据库 $DB_NAME 已存在"
    read -p "是否要重新创建数据库（将删除所有数据）？(yes/no): " confirm
    
    if [ "$confirm" == "yes" ]; then
        print_warning "删除现有数据库..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
        print_info "创建新数据库..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
        print_info "数据库创建成功 ✓"
    else
        print_info "跳过数据库创建"
    fi
else
    print_info "创建数据库..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    print_info "数据库创建成功 ✓"
fi

# 运行 Prisma 迁移
print_info "运行数据库迁移..."
cd idle-game-backend

if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

npx prisma migrate deploy || {
    print_error "数据库迁移失败！"
    exit 1
}

print_info "数据库迁移完成 ✓"

# 初始化基础数据
print_info "初始化基础数据..."

# 可以在这里添加初始化数据的 SQL
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- 添加初始化数据
-- 例如：初始化商店商品、任务配置等

-- 检查数据是否已初始化
DO \$\$
BEGIN
    -- 可以添加初始化逻辑
    RAISE NOTICE '数据库初始化完成';
END \$\$;
EOF

cd ..

print_info ""
print_info "========================================="
print_info "数据库初始化完成！"
print_info "========================================="
print_info "数据库信息："
print_info "  - 数据库名: $DB_NAME"
print_info "  - 连接地址: postgresql://$DB_USER:****@$DB_HOST:$DB_PORT/$DB_NAME"
print_info ""
print_info "下一步："
print_info "  1. 启动后端服务"
print_info "  2. 调用初始化接口初始化商店数据和任务数据"
print_info "     POST http://your-api/api/shop/init"
print_info "     POST http://your-api/api/task/init"

