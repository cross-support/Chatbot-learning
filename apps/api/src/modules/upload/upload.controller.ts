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
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      heic: 'image/heic',
    };

    res.setHeader('Content-Type', contentTypeMap[ext || ''] || 'application/octet-stream');
    res.send(buffer);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'アップロード確認' })
  async confirmUpload(@Body() body: { fileKey: string }) {
    return this.uploadService.confirmUpload(body.fileKey);
  }
}
