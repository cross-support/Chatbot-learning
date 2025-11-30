import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('api/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Post('session')
  @ApiOperation({ summary: 'セッション作成' })
  async createSession() {
    return this.userService.createSession();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ユーザー詳細取得' })
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ユーザー情報更新' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; phone?: string; company?: string; memo?: string },
  ) {
    return this.userService.update(id, body);
  }

  @Get(':id/visits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '行動履歴取得' })
  async getVisitLogs(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.userService.getVisitLogs(id, limit ? Number(limit) : undefined);
  }

  @Get(':id/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '会話履歴取得' })
  async getConversationHistory(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.userService.getConversationHistory(id, limit ? Number(limit) : undefined);
  }
}
