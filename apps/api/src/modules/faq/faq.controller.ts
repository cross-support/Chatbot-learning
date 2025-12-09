import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FaqService } from './faq.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  // FAQ一覧
  @Get()
  async getFaqs(@Query('approved') approved?: string) {
    // approvedパラメータがある場合は承認済みのみ
    if (approved === 'true') {
      return this.faqService.getApprovedFaqs();
    }
    return this.faqService.getAllFaqs();
  }

  // 提案一覧（未承認含む）
  @Get('suggestions')
  @UseGuards(JwtAuthGuard)
  async getSuggestions(
    @Query('status') status?: string,
    @Query('sortBy') sortBy: string = 'frequency',
  ) {
    return this.faqService.getSuggestions(status, sortBy);
  }

  // 類似質問検索
  @Get('search')
  async searchSimilar(@Query('q') query: string) {
    if (!query) {
      return [];
    }
    return this.faqService.searchSimilar(query);
  }

  // FAQ手動追加
  @Post()
  @UseGuards(JwtAuthGuard)
  async createFaq(
    @Body() createDto: { question: string; answer: string },
  ) {
    return this.faqService.createFaq(createDto);
  }

  // 提案を承認
  @Post('suggestions/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveSuggestion(@Param('id') id: string) {
    return this.faqService.approveSuggestion(id);
  }

  // 提案を却下
  @Post('suggestions/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectSuggestion(@Param('id') id: string) {
    return this.faqService.rejectSuggestion(id);
  }

  // FAQ更新
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateFaq(
    @Param('id') id: string,
    @Body() updateDto: { question?: string; answer?: string },
  ) {
    return this.faqService.updateFaq(id, updateDto);
  }

  // FAQ削除
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteFaq(@Param('id') id: string) {
    return this.faqService.deleteFaq(id);
  }

  // FAQ統計
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.faqService.getStats();
  }

  // ナレッジベース統合検索（FAQ + テンプレート + シナリオ）
  @Get('knowledge/search')
  @UseGuards(JwtAuthGuard)
  async searchKnowledge(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return [];
    }
    return this.faqService.searchKnowledge(query, limit ? parseInt(limit, 10) : 10);
  }
}
