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
} from '@nestjs/common';
import { SegmentService, CreateSegmentData } from './segment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/segments')
@UseGuards(JwtAuthGuard)
export class SegmentController {
  constructor(private readonly segmentService: SegmentService) {}

  // ===== セグメント管理 =====

  @Post()
  async createSegment(@Body() body: CreateSegmentData) {
    return this.segmentService.createSegment(body);
  }

  @Get()
  async getSegments() {
    return this.segmentService.getSegments();
  }

  @Get('stats')
  async getSegmentStats() {
    return this.segmentService.getSegmentStats();
  }

  @Get(':id')
  async getSegment(@Param('id') id: string) {
    return this.segmentService.getSegment(id);
  }

  @Put(':id')
  async updateSegment(
    @Param('id') id: string,
    @Body() body: Partial<CreateSegmentData>,
  ) {
    return this.segmentService.updateSegment(id, body);
  }

  @Delete(':id')
  async deleteSegment(@Param('id') id: string) {
    return this.segmentService.deleteSegment(id);
  }

  // ===== メンバーシップ管理 =====

  @Get(':id/members')
  async getMembers(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.segmentService.getMembers(
      id,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.segmentService.addMember(id, body.userId);
  }

  @Post(':id/members/bulk')
  async addMembers(
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
  ) {
    return this.segmentService.addMembers(id, body.userIds);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.segmentService.removeMember(id, userId);
  }

  // ===== 動的セグメント評価 =====

  @Post(':id/evaluate')
  async evaluateSegment(@Param('id') id: string) {
    return this.segmentService.evaluateSegment(id);
  }

  @Post('evaluate-all')
  async evaluateAllSegments() {
    return this.segmentService.evaluateAllSegments();
  }

  // ===== ユーザーのセグメント =====

  @Get('user/:userId')
  async getUserSegments(@Param('userId') userId: string) {
    return this.segmentService.getUserSegments(userId);
  }
}
