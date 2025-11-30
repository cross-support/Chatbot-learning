import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG } from '@crossbot/shared';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadService {
  private uploadDir: string;

  constructor(private configService: ConfigService) {
    // ローカル開発用のアップロードディレクトリ
    this.uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 画像アップロード用のURLを生成
   * 本番環境ではS3 Presigned URLを使用
   */
  async generateUploadUrl(
    conversationId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
  ): Promise<{ uploadUrl: string; fileKey: string; isLocal: boolean }> {
    // バリデーション
    if (!CONFIG.IMAGE.ALLOWED_TYPES.includes(contentType as typeof CONFIG.IMAGE.ALLOWED_TYPES[number])) {
      throw new BadRequestException('対応していないファイル形式です');
    }

    if (fileSize > CONFIG.IMAGE.MAX_SIZE) {
      throw new BadRequestException('ファイルサイズが5MBを超えています');
    }

    // ユニークなファイルキーを生成
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(fileName) || this.getExtensionFromMime(contentType);
    const fileKey = `${conversationId}/${timestamp}_${randomStr}${ext}`;

    // ローカル開発モード
    const isLocal = this.configService.get('NODE_ENV') === 'development' || !this.configService.get('S3_BUCKET_NAME');

    if (isLocal) {
      // ローカルアップロード用のエンドポイント
      const uploadUrl = `/api/uploads/local/${fileKey}`;
      return { uploadUrl, fileKey, isLocal: true };
    }

    // TODO: S3 Presigned URL生成（本番環境）
    // AWS SDKを使用してPresigned URLを生成
    throw new BadRequestException('S3アップロードは現在設定されていません');
  }

  /**
   * ローカルファイルアップロード（開発用）
   */
  async saveLocalFile(fileKey: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(this.uploadDir, fileKey);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    return `/api/uploads/files/${fileKey}`;
  }

  /**
   * ローカルファイル取得（開発用）
   */
  async getLocalFile(fileKey: string): Promise<Buffer | null> {
    const filePath = path.join(this.uploadDir, fileKey);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }

  /**
   * アップロード確認
   */
  async confirmUpload(fileKey: string): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    const isLocal = this.configService.get('NODE_ENV') === 'development' || !this.configService.get('S3_BUCKET_NAME');

    if (isLocal) {
      const imageUrl = `/api/uploads/files/${fileKey}`;
      return { imageUrl, thumbnailUrl: imageUrl };
    }

    // TODO: S3ファイル存在確認と表示用URL生成
    throw new BadRequestException('S3アップロードは現在設定されていません');
  }

  /**
   * MIMEタイプから拡張子を取得
   */
  private getExtensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/heic': '.heic',
    };
    return map[mimeType] || '.jpg';
  }
}
