import { Controller, Post, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1分に5回まで（ブルートフォース対策）
  @ApiOperation({ summary: '管理者ログイン' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト' })
  async logout(@Req() req: RequestWithUser) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    return this.authService.logout(req.user.id, token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '現在のユーザー情報取得' })
  async getMe(@Req() req: RequestWithUser) {
    return this.authService.getMe(req.user.id);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理者登録（管理者のみ）' })
  async register(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.createAdmin(createAdminDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'パスワード変更' })
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Get('password-policy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'パスワードポリシー取得' })
  async getPasswordPolicy() {
    return this.authService.getPasswordPolicySettings();
  }

  @Patch('password-policy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'パスワードポリシー更新（管理者のみ）' })
  async updatePasswordPolicy(
    @Body() body: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
      maxLoginAttempts?: number;
      lockoutDurationMinutes?: number;
      passwordExpiryDays?: number;
    },
  ) {
    return this.authService.updatePasswordPolicy(body);
  }

  @Post('admins/:id/unlock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'アカウントロック解除（管理者のみ）' })
  async unlockAdmin(@Param('id') id: string) {
    return this.authService.unlockAdmin(id);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA設定開始（QRコード生成）' })
  async setup2FA(@Req() req: RequestWithUser) {
    return this.authService.setup2FA(req.user.id);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA検証' })
  async verify2FA(@Req() req: RequestWithUser, @Body() body: { token: string }) {
    return this.authService.verify2FA(req.user.id, body.token);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA無効化' })
  async disable2FA(@Req() req: RequestWithUser, @Body() body: { password: string }) {
    return this.authService.disable2FA(req.user.id, body.password);
  }

  @Post('2fa/verify-login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'ログイン時の2FA検証' })
  async verify2FALogin(@Body() body: { email: string; token: string }) {
    return this.authService.verify2FALogin(body.email, body.token);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA有効状態確認' })
  async check2FAStatus(@Req() req: RequestWithUser) {
    return this.authService.check2FAStatus(req.user.id);
  }
}
