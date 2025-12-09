# CrossBot デプロイ・運用マニュアル

<!--
================================================================================
CrossBot Deployment & Operations Guide
================================================================================
このドキュメントは CrossBot の本番デプロイおよび運用に関するガイドです。
開発者・運用担当者向けの情報をまとめています。

作成日: 2025-12-09
最終更新: 2025-12-09
================================================================================
-->

## 目次

1. [推奨サーバー](#推奨サーバー)
2. [デプロイ方法](#デプロイ方法)
3. [自動デプロイ設定](#自動デプロイ設定)
4. [環境変数](#環境変数)
5. [運用Tips](#運用tips)

---

## 推奨サーバー

### おすすめ1: Render（イチオシ）

<!--
Renderは設定が簡単で、GitHubプッシュで自動デプロイが可能。
初めてのデプロイに最適。
-->

| 項目 | 内容 |
|------|------|
| 月額 | 約$25〜（約3,800円〜） |
| 特徴 | GitHubプッシュで自動デプロイ、Docker対応、DB込みプランあり |
| 公式サイト | https://render.com |

**メリット:**
- 設定画面がシンプルで分かりやすい
- PostgreSQLが同一プラットフォームで管理可能
- SSL証明書が自動発行される

**デプロイ手順:**
1. Renderアカウント作成
2. New > Web Service を選択
3. GitHubリポジトリ `cross-support/Chatbot-learning` を接続
4. 以下の設定を入力:
   - Name: `crossbot-api`
   - Root Directory: `apps/api`
   - Build Command: `pnpm install && pnpm build`
   - Start Command: `pnpm start:prod`
5. 環境変数を設定（後述）
6. Create Web Service

---

### おすすめ2: Railway

<!--
Railwayはモダンで使いやすいUI。従量課金で無駄がない。
-->

| 項目 | 内容 |
|------|------|
| 月額 | 約$20〜（約3,000円〜） |
| 特徴 | モダンUI、PostgreSQL標準対応、従量課金 |
| 公式サイト | https://railway.app |

**メリット:**
- ダッシュボードが見やすい
- リアルタイムログが確認しやすい
- 使った分だけ課金される

---

### おすすめ3: さくらVPS + GitHub Actions

<!--
コストを最小限に抑えたい場合に最適。
ただし、初期設定に技術的知識が必要。
-->

| 項目 | 内容 |
|------|------|
| 月額 | 約1,000円〜 |
| 特徴 | 国内最安クラス、高速・安定、長期運用向け |
| 公式サイト | https://vps.sakura.ad.jp |

**メリット:**
- 国内サーバーで通信が速い
- 長期的なコストが最も安い
- 完全な管理権限

**デメリット:**
- 自動デプロイはGitHub Actionsで別途設定が必要
- サーバー管理の知識が必要

---

## デプロイ方法

### Docker Composeを使用（推奨）

```bash
# 1. サーバーにSSH接続
ssh user@your-server

# 2. リポジトリをクローン
git clone https://github.com/cross-support/Chatbot-learning.git
cd Chatbot-learning

# 3. 環境変数ファイルを作成
cp deploy/.env.example .env
# .envを編集して本番用の値を設定

# 4. Docker Composeで起動
docker-compose -f deploy/docker-compose.prod.yml up -d

# 5. 動作確認
curl http://localhost:3000/health
```

### 手動アップデート

```bash
# サーバーにSSH接続後
cd Chatbot-learning
git pull origin main
docker-compose -f deploy/docker-compose.prod.yml up -d --build
```

---

## 自動デプロイ設定

<!--
================================================================================
以下はGitHub Actionsを使った自動デプロイの設定例です。
Cursorで改修 → git push → 自動で本番反映 の流れを実現します。
================================================================================
-->

### GitHub Actions設定例

`.github/workflows/deploy.yml` を作成:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /path/to/Chatbot-learning
            git pull origin main
            docker-compose -f deploy/docker-compose.prod.yml up -d --build
```

### 必要なGitHub Secrets

リポジトリの Settings > Secrets and variables > Actions で以下を設定:

| Secret名 | 値 |
|----------|-----|
| `SERVER_HOST` | サーバーのIPアドレスまたはホスト名 |
| `SERVER_USER` | SSHユーザー名 |
| `SERVER_SSH_KEY` | SSH秘密鍵（`~/.ssh/id_rsa`の中身） |

---

## 環境変数

<!--
本番環境で必須の環境変数リストです。
セキュリティ上、実際の値はGitにコミットしないでください。
-->

### 必須の環境変数

```env
# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/crossbot

# JWT認証
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# OpenAI API（AI自動応答用）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# サーバー設定
NODE_ENV=production
PORT=3000

# CORS設定（フロントエンドのURL）
CORS_ORIGINS=https://your-admin-domain.com,https://your-widget-domain.com
```

### オプションの環境変数

```env
# メール通知
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password

# Slack連携
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# 監視・ログ
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 運用Tips

### ログの確認

```bash
# Docker Composeのログを確認
docker-compose -f deploy/docker-compose.prod.yml logs -f api

# 特定のサービスのログのみ
docker-compose -f deploy/docker-compose.prod.yml logs -f api --tail=100
```

### データベースバックアップ

```bash
# バックアップ作成
docker-compose exec db pg_dump -U crossbot crossbot > backup_$(date +%Y%m%d).sql

# バックアップ復元
docker-compose exec -T db psql -U crossbot crossbot < backup_20251209.sql
```

### サービス再起動

```bash
# 全サービス再起動
docker-compose -f deploy/docker-compose.prod.yml restart

# APIのみ再起動
docker-compose -f deploy/docker-compose.prod.yml restart api
```

### ヘルスチェック

```bash
# APIの状態確認
curl https://your-api-domain.com/health

# データベース接続確認
curl https://your-api-domain.com/api/health/db
```

---

## トラブルシューティング

<!--
よくある問題と解決方法をまとめています。
問題が発生した場合は、まずここを確認してください。
-->

### APIが起動しない

1. ログを確認: `docker-compose logs api`
2. 環境変数が正しく設定されているか確認
3. データベースへの接続を確認

### データベース接続エラー

1. PostgreSQLコンテナが起動しているか確認
2. `DATABASE_URL`の形式が正しいか確認
3. ファイアウォール設定を確認

### 自動デプロイが動かない

1. GitHub Actionsのログを確認
2. SSH接続が正しく設定されているか確認
3. サーバーのディスク容量を確認

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-09 | 初版作成 |
