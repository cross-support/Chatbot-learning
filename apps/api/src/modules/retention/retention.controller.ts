import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RetentionService } from './retention.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get('policies')
  async getPolicies() {
    return this.retentionService.getPolicies();
  }

  @Put('policies')
  async upsertPolicy(
    @Body()
    body: {
      entity: string;
      retentionDays: number;
      isEnabled?: boolean;
    },
  ) {
    return this.retentionService.upsertPolicy(body);
  }

  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: string) {
    return this.retentionService.deletePolicy(id);
  }

  @Post('execute')
  async executeRetention() {
    const results = await this.retentionService.executeRetention();
    return { success: true, results };
  }

  @Post('initialize')
  async initializeDefaults() {
    return this.retentionService.initializeDefaultPolicies();
  }
}
