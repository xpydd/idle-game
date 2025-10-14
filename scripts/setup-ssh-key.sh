#!/bin/bash

# SSH 密钥配置脚本
# 用于配置到服务器的 SSH 密钥认证

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
SERVER_PASSWORD="x312967424X."

echo "========================================"
echo "  SSH 密钥配置工具"
echo "  目标服务器: ${SERVER_HOST}"
echo "========================================"
echo ""

# 检查是否已有 SSH 密钥
check_existing_key() {
    print_step "检查现有 SSH 密钥..."
    
    if [ -f ~/.ssh/id_rsa.pub ]; then
        print_info "找到现有的 SSH 密钥 ✓"
        echo ""
        print_warning "公钥内容："
        cat ~/.ssh/id_rsa.pub
        echo ""
        read -p "是否使用现有密钥？(y/n): " use_existing
        
        if [ "$use_existing" = "y" ] || [ "$use_existing" = "Y" ]; then
            return 0
        else
            generate_new_key
        fi
    else
        print_warning "未找到 SSH 密钥，将生成新密钥"
        generate_new_key
    fi
}

# 生成新的 SSH 密钥
generate_new_key() {
    print_step "生成新的 SSH 密钥..."
    
    read -p "请输入你的邮箱（用于标识密钥）: " email
    
    if [ -z "$email" ]; then
        email="deploy@idle-game"
    fi
    
    # 生成密钥
    ssh-keygen -t rsa -b 4096 -C "$email" -f ~/.ssh/id_rsa -N ""
    
    print_info "SSH 密钥生成成功 ✓"
}

# 复制公钥到服务器
copy_key_to_server() {
    print_step "将公钥复制到服务器..."
    
    # 检查是否安装了 sshpass
    if command -v sshpass &> /dev/null; then
        print_info "使用 sshpass 复制公钥..."
        
        # 创建 .ssh 目录（如果不存在）
        sshpass -p "${SERVER_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} \
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
        
        # 复制公钥
        sshpass -p "${SERVER_PASSWORD}" ssh-copy-id -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST}
        
        print_info "公钥复制成功 ✓"
    else
        print_warning "未安装 sshpass，将使用手动方式"
        print_info ""
        print_info "请执行以下命令（需要输入服务器密码）："
        echo ""
        echo "  ssh-copy-id ${SERVER_USER}@${SERVER_HOST}"
        echo ""
        print_info "服务器密码: ${SERVER_PASSWORD}"
        echo ""
        read -p "按回车键继续..."
        
        ssh-copy-id ${SERVER_USER}@${SERVER_HOST}
    fi
}

# 测试 SSH 连接
test_connection() {
    print_step "测试 SSH 连接..."
    
    if ssh -o BatchMode=yes -o ConnectTimeout=5 ${SERVER_USER}@${SERVER_HOST} "echo 'SSH连接测试成功'" 2>/dev/null; then
        print_info "SSH 密钥认证成功 ✓"
        return 0
    else
        print_error "SSH 密钥认证失败 ✗"
        return 1
    fi
}

# 显示使用说明
show_usage() {
    echo ""
    echo "========================================"
    print_info "配置完成！"
    echo "========================================"
    echo ""
    print_info "现在你可以无密码连接到服务器："
    echo "  ssh ${SERVER_USER}@${SERVER_HOST}"
    echo ""
    print_info "开始部署应用："
    echo "  ./scripts/deploy-to-server.sh deploy"
    echo ""
}

# 主流程
main() {
    check_existing_key
    copy_key_to_server
    
    if test_connection; then
        show_usage
    else
        print_error "配置失败，请检查网络连接和服务器状态"
        exit 1
    fi
}

main


