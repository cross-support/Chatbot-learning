import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('backup')
@Controller('api/backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BackupController {
  constructor(private backupService: BackupService) {}

  @Post('create')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'バックアップ作成' })
  async createBackup() {
    return this.backupService.createBackup();
  }

  @Get('list')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'バックアップ一覧' })
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get('download/:filename')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'バックアップダウンロード' })
  async downloadBackup(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filepath = this.backupService.getBackupPath(filename);
    res.download(filepath, filename);
  }

  @Post('restore/:filename')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'バックアップからリストア' })
  async restoreBackup(@Param('filename') filename: string) {
    await this.backupService.restoreBackup(filename);
    return { success: true, message: 'リストアが完了しました' };
  }

  @Delete(':filename')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'バックアップ削除' })
  async deleteBackup(@Param('filename') filename: string) {
    await this.backupService.deleteBackup(filename);
    return { success: true };
  }

  @Delete('cleanup')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: '古いバックアップを削除' })
  async cleanupBackups(@Query('days') days?: string) {
    const daysToKeep = days ? parseInt(days, 10) : 30;
    const deleted = await this.backupService.cleanupOldBackups(daysToKeep);
    return { deleted };
  }

  @Post('export')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'データエクスポート（JSON）' })
  async exportData(
    @Body() body: { tables: string[] },
    @Res() res: Response,
  ) {
    const tables = body.tables || ['users', 'conversations', 'scenarios', 'templates'];
    const data = await this.backupService.exportData(tables);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `export-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
