import { Controller, Get, Delete, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionService } from '../../common/services/session.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@ApiTags('sessions')
@Controller('api/admins/:adminId/sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  private checkPermissions(request: RequestWithUser, adminId: string) {
    if (request.user.role !== 'SUPER_ADMIN' && request.user.id !== adminId) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'アクティブなセッション一覧を取得' })
  async getActiveSessions(
    @Param('adminId') adminId: string,
    @Req() req: RequestWithUser,
  ) {
    this.checkPermissions(req, adminId);
    return this.sessionService.getActiveSessions(adminId);
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: '指定したセッションを終了' })
  async terminateSession(
    @Param('adminId') adminId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: RequestWithUser,
  ) {
    this.checkPermissions(req, adminId);
    return this.sessionService.terminateSession(sessionId, adminId);
  }
}
