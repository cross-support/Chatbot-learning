#!/bin/bash
# =====================================================
# CrossBot デプロイスクリプト
# さくらVPS等のサーバーで実行
# =====================================================

set -e

echo "=========================================="
echo "CrossBot デプロイスクリプト"
echo "=========================================="

# 設定
DEPLOY_DIR="/var/www/crossbot"
REPO_URL="your-git-repo-url"  # GitリポジトリURLに変更

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. 環境チェック
print_status "環境をチェックしています..."

if ! command -v docker &> /dev/null; then
    print_error "Dockerがインストールされていません"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Composeがインストールされていません"
    exit 1
fi

# 2. デプロイディレクトリ作成
print_status "デプロイディレクトリを準備しています..."
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# 3. 最新コードを取得
if [ -d ".git" ]; then
    print_status "最新コードを取得しています..."
    git pull origin main
else
    print_status "リポジトリをクローンしています..."
    git clone $REPO_URL .
fi

# 4. 環境変数ファイルチェック
if [ ! -f "deploy/.env" ]; then
    print_warning ".envファイルが見つかりません"
    print_status ".env.exampleからコピーしています..."
    cp deploy/.env.example deploy/.env
    print_warning "deploy/.env を編集して環境変数を設定してください"
    exit 1
fi

# 5. Dockerイメージをビルド
print_status "Dockerイメージをビルドしています..."
cd deploy
docker-compose -f docker-compose.prod.yml build --no-cache

# 6. 古いコンテナを停止
print_status "古いコンテナを停止しています..."
docker-compose -f docker-compose.prod.yml down

# 7. 新しいコンテナを起動
print_status "新しいコンテナを起動しています..."
docker-compose -f docker-compose.prod.yml up -d

# 8. ヘルスチェック
print_status "ヘルスチェックを実行しています..."
sleep 10

if curl -s http://localhost:3000/health > /dev/null; then
    print_status "APIサーバーが正常に起動しました"
else
    print_error "APIサーバーの起動に失敗しました"
    docker-compose -f docker-compose.prod.yml logs api
    exit 1
fi

# 9. 不要なイメージを削除
print_status "不要なDockerイメージを削除しています..."
docker image prune -f

echo ""
echo "=========================================="
echo -e "${GREEN}デプロイが完了しました！${NC}"
echo "=========================================="
echo ""
echo "確認コマンド:"
echo "  docker-compose -f docker-compose.prod.yml ps"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
