import { Controller, Post, Get, Body, Param, UseInterceptors, UploadedFile, Res, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('uploads')
@Controller('api/uploads')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  /**
   * シナリオエディター用画像アップロード
   */
  @Post('scenario-image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'シナリオ用画像アップロード' })
  async uploadScenarioImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { success: false, error: 'ファイルが見つかりません' };
    }

    // 画像ファイルのみ許可
    if (!file.mimetype.startsWith('image/')) {
      return { success: false, error: '画像ファイルのみアップロード可能です' };
    }

    const fileKey = `scenarios/${Date.now()}_${file.originalname}`;
    const imageUrl = await this.uploadService.saveLocalFile(fileKey, file.buffer);

    return {
      success: true,
      imageUrl,
      fileKey,
    };
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'アップロードURL発行' })
  async generatePresignedUrl(
    @Body()
    body: {
      conversationId: string;
      fileName: string;
      contentType: string;
      fileSize: number;
    },
  ) {
    return this.uploadService.generateUploadUrl(
      body.conversationId,
      body.fileName,
      body.contentType,
      body.fileSize,
    );
  }

  @Post('local/:conversationId/:fileName')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'ローカルファイルアップロード（開発用）' })
  async uploadLocal(
    @Param('conversationId') conversationId: string,
    @Param('fileName') fileName: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { success: false, error: 'ファイルが見つかりません' };
    }

    const fileKey = `${conversationId}/${fileName}`;
    const imageUrl = await this.uploadService.saveLocalFile(fileKey, file.buffer);

    return {
      success: true,
      imageUrl,
      fileKey,
    };
  }

  @Get('files/:conversationId/:fileName')
  @ApiOperation({ summary: 'ファイル取得（開発用）' })
  async getFile(
    @Param('conversationId') conversationId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const fileKey = `${conversationId}/${fileName}`;
    const buffer = await this.uploadService.getLocalFile(fileKey);

    if (!buffer) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }

    // 拡張子からContent-Typeを推測
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      // 画像
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      heic: 'image/heic',
      // ドキュメント
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

    // CORSヘッダーを追加（ウィジェットからのアクセスを許可）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', contentType);

    // PDFや文書ファイルの場合はインライン表示を許可しつつダウンロード名も設定
    if (contentType === 'application/pdf' || contentType.includes('document') || contentType.includes('spreadsheet')) {
      // RFC 5987準拠のContent-Dispositionヘッダー（日本語ファイル名対応）
      const originalName = decodeURIComponent(fileName.split('_').slice(1).join('_') || fileName);
      const asciiFilename = originalName.replace(/[^\x20-\x7E]/g, '_');
      const utf8Filename = encodeURIComponent(originalName).replace(/'/g, '%27');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
      );
    }

    res.send(buffer);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'アップロード確認' })
  async confirmUpload(@Body() body: { fileKey: string }) {
    return this.uploadService.confirmUpload(body.fileKey);
  }
}
