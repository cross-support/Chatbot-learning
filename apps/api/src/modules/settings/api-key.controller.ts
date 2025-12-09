import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('api-keys')
@Controller('api/settings/api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'APIキー一覧取得' })
  async findAll() {
    return this.apiKeyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'APIキー詳細取得' })
  async findById(@Param('id') id: string) {
    return this.apiKeyService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'APIキー作成' })
  async create(
    @Body() body: {
      name: string;
      permissions?: Record<string, unknown>;
      expiresAt?: string;
    },
  ) {
    return this.apiKeyService.create(
      body.name,
      body.permissions,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'APIキー更新' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      permissions?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    return this.apiKeyService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'APIキー削除' })
  async delete(@Param('id') id: string) {
    return this.apiKeyService.delete(id);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'APIキー再生成' })
  async regenerate(@Param('id') id: string) {
    return this.apiKeyService.regenerate(id);
  }
}
