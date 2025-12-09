import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CONFIG } from '@crossbot/shared';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private uploadDir: string;
  private s3Client: S3Client | null = null;
  private bucketName: string | undefined;
  private cdnUrl: string | undefined;

  constructor(private configService: ConfigService) {
    // ローカル開発用のアップロードディレクトリ
    this.uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // S3クライアントの初期化
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME');
    this.cdnUrl = this.configService.get<string>('CDN_URL');
    const region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (this.bucketName && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('S3クライアントを初期化しました');
    }
  }

  /**
   * ファイルアップロード用のURLを生成
   * 本番環境ではS3 Presigned URLを使用
   */
  async generateUploadUrl(
    conversationId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
  ): Promise<{ uploadUrl: string; fileKey: string; isLocal: boolean }> {
    // バリデーション - 画像またはドキュメントファイルを許可
    const isImage = CONFIG.IMAGE.ALLOWED_TYPES.includes(contentType as typeof CONFIG.IMAGE.ALLOWED_TYPES[number]);
    const isDocument = CONFIG.FILE.ALLOWED_TYPES.includes(contentType as typeof CONFIG.FILE.ALLOWED_TYPES[number]);

    if (!isImage && !isDocument) {
      throw new BadRequestException('対応していないファイル形式です');
    }

    const maxSize = isImage ? CONFIG.IMAGE.MAX_SIZE : CONFIG.FILE.MAX_SIZE;
    if (fileSize > maxSize) {
      throw new BadRequestException(`ファイルサイズが${maxSize / (1024 * 1024)}MBを超えています`);
    }

    // ユニークなファイルキーを生成
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(fileName) || this.getExtensionFromMime(contentType);
    const fileKey = `${conversationId}/${timestamp}_${randomStr}${ext}`;

    // ローカル開発モード（S3未設定の場合）
    if (!this.s3Client || !this.bucketName) {
      // ローカルアップロード用のエンドポイント
      const uploadUrl = `/api/uploads/local/${fileKey}`;
      return { uploadUrl, fileKey, isLocal: true };
    }

    // S3 Presigned URL生成（本番環境）
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `uploads/${fileKey}`,
        ContentType: contentType,
        ContentLength: fileSize,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 300, // 5分間有効
      });

      return { uploadUrl, fileKey, isLocal: false };
    } catch (error) {
      this.logger.error('S3 Presigned URL生成エラー:', error);
      throw new BadRequestException('アップロードURLの生成に失敗しました');
    }
  }

  /**
   * ファイルキーのバリデーション（パストラバーサル対策）
   */
  private validateFileKey(fileKey: string): string | null {
    // パストラバーサル攻撃対策
    if (fileKey.includes('..') || fileKey.startsWith('/') || fileKey.startsWith('\\')) {
      this.logger.warn(`Invalid file key detected: ${fileKey}`);
      return null;
    }

    // 期待されるパターン: conversationId/timestamp_randomStr.ext
    const sanitizedKey = fileKey.replace(/[^a-zA-Z0-9_\-./]/g, '_');
    const fullPath = path.join(this.uploadDir, sanitizedKey);

    // 絶対パスで検証（uploadDir外へのアクセスを防止）
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadDir = path.resolve(this.uploadDir);
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
      this.logger.warn(`Path traversal attempt detected: ${fileKey}`);
      return null;
    }

    return fullPath;
  }

  /**
   * ローカルファイルアップロード（開発用）
   */
  async saveLocalFile(fileKey: string, buffer: Buffer): Promise<string> {
    const filePath = this.validateFileKey(fileKey);
    if (!filePath) {
      throw new BadRequestException('不正なファイルキーです');
    }

    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    // 相対パスを返す（Viteプロキシ経由でアクセス可能にするため）
    // 本番環境ではAPI_URLを使用
    const apiUrl = this.configService.get<string>('API_URL');
    if (apiUrl && apiUrl !== 'http://localhost:3000') {
      return `${apiUrl}/api/uploads/files/${fileKey}`;
    }
    // 開発環境では相対パスを使用（Viteプロキシ経由）
    return `/api/uploads/files/${fileKey}`;
  }

  /**
   * ローカルファイル取得（開発用）
   */
  async getLocalFile(fileKey: string): Promise<Buffer | null> {
    const filePath = this.validateFileKey(fileKey);
    if (!filePath) {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }

  /**
   * アップロード確認
   */
  async confirmUpload(fileKey: string): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    // ローカル開発モード（S3未設定の場合）
    if (!this.s3Client || !this.bucketName) {
      // 相対パスを返す（Viteプロキシ経由でアクセス可能にするため）
      // 本番環境ではAPI_URLを使用
      const apiUrl = this.configService.get<string>('API_URL');
      let imageUrl: string;
      if (apiUrl && apiUrl !== 'http://localhost:3000') {
        imageUrl = `${apiUrl}/api/uploads/files/${fileKey}`;
      } else {
        // 開発環境では相対パスを使用（Viteプロキシ経由）
        imageUrl = `/api/uploads/files/${fileKey}`;
      }
      return { imageUrl, thumbnailUrl: imageUrl };
    }

    // S3ファイル存在確認
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: `uploads/${fileKey}`,
      });

      await this.s3Client.send(headCommand);

      // CDN URLがある場合はCDN経由、なければS3直接URL
      let imageUrl: string;
      if (this.cdnUrl) {
        imageUrl = `${this.cdnUrl}/uploads/${fileKey}`;
      } else {
        // S3署名付きURL（閲覧用、1時間有効）
        const getCommand = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: `uploads/${fileKey}`,
        });
        imageUrl = await getSignedUrl(this.s3Client, getCommand, {
          expiresIn: 3600,
        });
      }

      return { imageUrl, thumbnailUrl: imageUrl };
    } catch (error) {
      this.logger.error('S3ファイル確認エラー:', error);
      throw new BadRequestException('ファイルが見つかりません');
    }
  }

  /**
   * MIMEタイプから拡張子を取得
   */
  private getExtensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      // 画像
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/heic': '.heic',
      // ドキュメント
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };
    return map[mimeType] || '.bin';
  }

  /**
   * ファイルタイプが画像かどうか判定
   */
  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * ファイルタイプがドキュメント（PDF等）かどうか判定
   */
  isDocumentFile(mimeType: string): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    return documentTypes.includes(mimeType);
  }
}
