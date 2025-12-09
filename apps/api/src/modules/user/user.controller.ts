import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { LabelService } from './label.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('api/users')
export class UserController {
  constructor(
    private userService: UserService,
    private labelService: LabelService,
  ) {}

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

  @Get(':id/labels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ユーザーのラベル一覧取得' })
  async getUserLabels(@Param('id') id: string) {
    return this.labelService.getUserLabels(id);
  }

  @Put(':id/labels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ユーザーのラベル一括設定' })
  async setUserLabels(@Param('id') id: string, @Body() body: { labelIds: string[] }) {
    return this.labelService.setUserLabels(id, body.labelIds);
  }

  @Post(':id/labels/:labelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ユーザーにラベルを追加' })
  async assignLabel(@Param('id') id: string, @Param('labelId') labelId: string) {
    return this.labelService.assignLabelToUser(id, labelId);
  }

  @Patch(':id/labels/:labelId/remove')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ユーザーからラベルを削除' })
  async removeLabel(@Param('id') id: string, @Param('labelId') labelId: string) {
    return this.labelService.removeLabelFromUser(id, labelId);
  }
}
