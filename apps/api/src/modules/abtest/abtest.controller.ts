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
import { AbTestService, CreateTestData, TestStatus } from './abtest.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/abtests')
@UseGuards(JwtAuthGuard)
export class AbTestController {
  constructor(private readonly abTestService: AbTestService) {}

  // ===== テスト管理 =====

  @Post()
  async createTest(@Body() body: CreateTestData) {
    return this.abTestService.createTest(body);
  }

  @Get()
  async getTests(@Query('status') status?: TestStatus) {
    return this.abTestService.getTests(status);
  }

  @Get('summary')
  async getTestsSummary() {
    return this.abTestService.getTestsSummary();
  }

  @Get(':id')
  async getTest(@Param('id') id: string) {
    return this.abTestService.getTest(id);
  }

  @Put(':id')
  async updateTest(
    @Param('id') id: string,
    @Body() body: Partial<CreateTestData>,
  ) {
    return this.abTestService.updateTest(id, body);
  }

  @Delete(':id')
  async deleteTest(@Param('id') id: string) {
    return this.abTestService.deleteTest(id);
  }

  // ===== テスト状態管理 =====

  @Post(':id/start')
  async startTest(@Param('id') id: string) {
    return this.abTestService.startTest(id);
  }

  @Post(':id/pause')
  async pauseTest(@Param('id') id: string) {
    return this.abTestService.pauseTest(id);
  }

  @Post(':id/complete')
  async completeTest(@Param('id') id: string) {
    return this.abTestService.completeTest(id);
  }

  // ===== バリアント割り当て =====

  @Post(':id/assign')
  async assignVariant(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.abTestService.assignVariant(id, body.userId);
  }

  @Get('user/:userId/assignments')
  async getUserAssignments(@Param('userId') userId: string) {
    return this.abTestService.getUserAssignments(userId);
  }

  // ===== コンバージョン =====

  @Post(':id/conversion')
  async recordConversion(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.abTestService.recordConversion(id, body.userId);
  }

  // ===== 結果分析 =====

  @Get(':id/results')
  async getTestResults(@Param('id') id: string) {
    return this.abTestService.getTestResults(id);
  }
}
