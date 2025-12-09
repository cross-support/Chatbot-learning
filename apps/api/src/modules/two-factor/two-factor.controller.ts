import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@Controller('api/admins/:adminId/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  private checkPermissions(request: RequestWithUser, adminId: string) {
    if (request.user.role !== 'SUPER_ADMIN' && request.user.id !== adminId) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }
  }

  @Post('setup')
  async setup(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
  ) {
    this.checkPermissions(req, adminId);
    return this.twoFactorService.generateSecret(adminId);
  }

  @Post('verify')
  async verify(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
    @Body() body: { token: string },
  ) {
    this.checkPermissions(req, adminId);
    return this.twoFactorService.enableTwoFactor(adminId, body.token);
  }

  @Post('disable')
  async disable(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
    @Body() body: { token: string },
  ) {
    this.checkPermissions(req, adminId);
    return this.twoFactorService.disableTwoFactor(adminId, body.token);
  }

  @Post('verify-backup')
  async verifyBackupCode(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
    @Body() body: { code: string },
  ) {
    this.checkPermissions(req, adminId);
    const isValid = await this.twoFactorService.verifyBackupCode(
      adminId,
      body.code,
    );
    return { valid: isValid };
  }

  @Get('status')
  async getStatus(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
  ) {
    this.checkPermissions(req, adminId);
    return this.twoFactorService.getTwoFactorStatus(adminId);
  }

  @Post('regenerate-backup')
  async regenerateBackupCodes(
    @Param('adminId') adminId: string,
    @Request() req: RequestWithUser,
    @Body() body: { token: string },
  ) {
    this.checkPermissions(req, adminId);
    return this.twoFactorService.regenerateBackupCodes(adminId, body.token);
  }
}
