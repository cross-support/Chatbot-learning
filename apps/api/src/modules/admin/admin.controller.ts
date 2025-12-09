import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AdminRole, AdminStatus } from '@prisma/client';
import { SessionService } from '../../common/services/session.service';

@ApiTags('admins')
@Controller('api/admins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private adminService: AdminService,
    private sessionService: SessionService,
  ) {}

  @Get()
  @ApiOperation({ summary: '管理者一覧取得' })
  async findAll() {
    return this.adminService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '管理者詳細取得' })
  async findById(@Param('id') id: string) {
    return this.adminService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: '管理者作成' })
  async create(
    @Body()
    body: {
      email: string;
      name: string;
      password: string;
      role?: AdminRole;
      maxConcurrent?: number;
    },
    @Req() req: RequestWithUser,
  ) {
    // スーパー管理者のみ作成可能
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('スーパー管理者のみ実行可能です');
    }
    return this.adminService.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: '管理者更新' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      email?: string;
      name?: string;
      password?: string;
      role?: AdminRole;
      maxConcurrent?: number;
    },
    @Req() req: RequestWithUser,
  ) {
    // スーパー管理者のみ他人を編集可能
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('自分以外の情報は編集できません');
    }
    // 役割変更はスーパー管理者のみ
    if (body.role && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('役割の変更はスーパー管理者のみ可能です');
    }
    return this.adminService.update(id, body);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'ステータス更新' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: AdminStatus },
    @Req() req: RequestWithUser,
  ) {
    // 自分自身またはスーパー管理者のみ変更可能
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('自分以外のステータスは変更できません');
    }
    return this.adminService.updateStatus(id, body.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '管理者削除' })
  async delete(@Param('id') id: string, @Req() req: RequestWithUser) {
    // スーパー管理者のみ削除可能
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('スーパー管理者のみ実行可能です');
    }
    // 自分自身は削除不可
    if (req.user.id === id) {
      throw new ForbiddenException('自分自身は削除できません');
    }
    return this.adminService.delete(id);
  }

  @Put(':id/password')
  @ApiOperation({ summary: 'パスワード変更' })
  async changePassword(
    @Param('id') id: string,
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: RequestWithUser,
  ) {
    // 自分のパスワードのみ変更可能
    if (req.user.id !== id) {
      throw new ForbiddenException('自分のパスワードのみ変更可能です');
    }
    const result = await this.adminService.changePassword(
      id,
      body.currentPassword,
      body.newPassword,
    );
    if (!result.success) {
      throw new ForbiddenException(result.message);
    }
    return result;
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'アクティブセッション一覧取得' })
  async getSessions(@Param('id') id: string, @Req() req: RequestWithUser) {
    // 自分のセッションのみ取得可能（スーパー管理者は全員分可能）
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('自分のセッションのみ取得可能です');
    }
    return this.sessionService.getActiveSessions(id);
  }

  @Delete(':id/sessions/:sessionId')
  @ApiOperation({ summary: 'セッション終了' })
  async terminateSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Req() req: RequestWithUser,
  ) {
    // 自分のセッションのみ終了可能（スーパー管理者は全員分可能）
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('自分のセッションのみ終了可能です');
    }
    await this.sessionService.terminateSession(sessionId, id);
    return { message: 'セッションを終了しました' };
  }

  @Delete(':id/sessions')
  @ApiOperation({ summary: '全セッション終了' })
  async terminateAllSessions(@Param('id') id: string, @Req() req: RequestWithUser) {
    // 自分のセッションのみ終了可能（スーパー管理者は全員分可能）
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('自分のセッションのみ終了可能です');
    }
    await this.sessionService.deleteAllSessions(id);
    return { message: '全セッションを終了しました' };
  }
}
