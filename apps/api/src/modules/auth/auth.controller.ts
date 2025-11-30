import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: '管理者ログイン' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト' })
  async logout(@Req() req: RequestWithUser) {
    return this.authService.logout(req.user.id);
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
}
