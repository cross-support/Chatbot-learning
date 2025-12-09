import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { AttachmentService } from './attachment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('messageId') messageId?: string,
  ) {
    return this.attachmentService.uploadFile(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      messageId,
    );
  }

  @Get(':id')
  async getAttachment(@Param('id') id: string) {
    return this.attachmentService.getAttachment(id);
  }

  @Get(':id/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentService.getAttachment(id);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const filePath = this.attachmentService.getFilePath(attachment.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // RFC 5987準拠のContent-Dispositionヘッダー（日本語ファイル名対応）
    const asciiFilename = attachment.originalName.replace(/[^\x20-\x7E]/g, '_');
    const utf8Filename = encodeURIComponent(attachment.originalName).replace(/'/g, '%27');

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
    );

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Get('message/:messageId')
  async getMessageAttachments(@Param('messageId') messageId: string) {
    return this.attachmentService.getAttachmentsByMessage(messageId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteAttachment(@Param('id') id: string) {
    await this.attachmentService.deleteAttachment(id);
    return { success: true };
  }

  @Post('cleanup')
  @UseGuards(JwtAuthGuard)
  async cleanupOrphaned() {
    const count = await this.attachmentService.cleanupOrphanedFiles();
    return { success: true, cleanedCount: count };
  }
}
