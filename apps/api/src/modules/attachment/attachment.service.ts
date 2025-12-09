import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    messageId?: string,
  ) {
    // バリデーション
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed: ${file.mimetype}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // ファイル名を生成
    const ext = path.extname(file.originalname);
    const filename = `${uuid()}${ext}`;
    const storagePath = path.join(this.uploadDir, filename);

    // ファイルを保存
    fs.writeFileSync(storagePath, file.buffer);

    // データベースに記録
    const attachment = await this.prisma.attachment.create({
      data: {
        messageId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageUrl: `/uploads/${filename}`,
      },
    });

    this.logger.log(`File uploaded: ${filename} (${file.size} bytes)`);

    return attachment;
  }

  /**
   * 添付ファイルを取得
   */
  async getAttachment(id: string) {
    return this.prisma.attachment.findUnique({
      where: { id },
    });
  }

  /**
   * メッセージの添付ファイル一覧
   */
  async getAttachmentsByMessage(messageId: string) {
    return this.prisma.attachment.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 添付ファイルを削除
   */
  async deleteAttachment(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    // ファイルを削除（パストラバーサル対策付き）
    const filePath = this.getFilePath(attachment.filename);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // データベースから削除
    await this.prisma.attachment.delete({
      where: { id },
    });

    this.logger.log(`File deleted: ${attachment.filename}`);
  }

  /**
   * ファイルパスを取得（パストラバーサル対策付き）
   */
  getFilePath(filename: string): string | null {
    // ファイル名のバリデーション（パストラバーサル対策）
    const sanitized = path.basename(filename);
    if (sanitized !== filename || filename.includes('..')) {
      this.logger.warn(`Invalid filename detected: ${filename}`);
      return null;
    }

    const fullPath = path.join(this.uploadDir, sanitized);

    // 絶対パスで検証（uploadDir外へのアクセスを防止）
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadDir = path.resolve(this.uploadDir);
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
      this.logger.warn(`Path traversal attempt detected: ${filename}`);
      return null;
    }

    return fullPath;
  }

  /**
   * 古い添付ファイルをクリーンアップ
   */
  async cleanupOrphanedFiles() {
    // メッセージに紐づいていない添付ファイルを検索
    const orphaned = await this.prisma.attachment.findMany({
      where: { messageId: null },
    });

    let cleaned = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1); // 24時間以上前

    for (const attachment of orphaned) {
      if (attachment.createdAt < cutoffDate) {
        await this.deleteAttachment(attachment.id);
        cleaned++;
      }
    }

    this.logger.log(`Cleaned up ${cleaned} orphaned attachments`);
    return cleaned;
  }
}
