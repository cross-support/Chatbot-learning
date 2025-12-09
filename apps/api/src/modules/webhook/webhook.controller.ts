import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      url: string;
      events: string[];
      secret?: string;
    },
  ) {
    return this.webhookService.create(body.name, body.url, body.events, body.secret);
  }

  @Get()
  async findAll() {
    return this.webhookService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.webhookService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      url?: string;
      events?: string[];
      secret?: string;
      isActive?: boolean;
    },
  ) {
    return this.webhookService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.webhookService.remove(id);
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string) {
    return this.webhookService.getLogs(id);
  }
}
