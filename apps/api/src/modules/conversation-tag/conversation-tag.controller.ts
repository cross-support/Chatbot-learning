import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ConversationTagService } from './conversation-tag.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('conversation-tags')
@UseGuards(JwtAuthGuard)
export class ConversationTagController {
  constructor(private readonly tagService: ConversationTagService) {}

  // ===== タグ管理 =====

  @Post()
  async createTag(@Body() body: { name: string; color?: string }) {
    return this.tagService.createTag(body);
  }

  @Get()
  async getTags() {
    return this.tagService.getTags();
  }

  @Put(':id')
  async updateTag(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string },
  ) {
    return this.tagService.updateTag(id, body);
  }

  @Delete(':id')
  async deleteTag(@Param('id') id: string) {
    return this.tagService.deleteTag(id);
  }

  @Get('stats')
  async getStats() {
    return this.tagService.getTagStats();
  }

  // ===== 会話タグ割り当て =====

  @Post('assign')
  async assignTag(
    @Request() req: { user: { id: string } },
    @Body() body: { conversationId: string; tagId: string },
  ) {
    return this.tagService.assignTag(
      body.conversationId,
      body.tagId,
      req.user.id,
    );
  }

  @Post('assign-multiple')
  async assignMultiple(
    @Request() req: { user: { id: string } },
    @Body() body: { conversationId: string; tagIds: string[] },
  ) {
    return this.tagService.assignMultipleTags(
      body.conversationId,
      body.tagIds,
      req.user.id,
    );
  }

  @Delete('assign/:conversationId/:tagId')
  async removeTag(
    @Param('conversationId') conversationId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagService.removeTag(conversationId, tagId);
  }

  @Get('conversation/:conversationId')
  async getConversationTags(@Param('conversationId') conversationId: string) {
    return this.tagService.getConversationTags(conversationId);
  }

  @Put('conversation/:conversationId')
  async replaceConversationTags(
    @Request() req: { user: { id: string } },
    @Param('conversationId') conversationId: string,
    @Body() body: { tagIds: string[] },
  ) {
    return this.tagService.replaceConversationTags(
      conversationId,
      body.tagIds,
      req.user.id,
    );
  }

  // ===== 検索 =====

  @Get('search')
  async findByTags(
    @Query('tags') tags: string,
    @Query('matchAll') matchAll?: string,
  ) {
    const tagIds = tags.split(',');
    return this.tagService.findConversationsByTags(tagIds, matchAll === 'true');
  }
}
