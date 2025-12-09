import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@ApiTags('api-keys')
@Controller('api/api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'APIキー一覧取得' })
  async findAll(@Req() req: RequestWithUser) {
    // 管理者のみアクセス可能
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('管理者のみアクセス可能です');
    }
    return this.apiKeyService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'APIキー作成' })
  async create(
    @Req() req: RequestWithUser,
    @Body() body: {
      name: string;
      permissions?: string[];
      expiresAt?: string;
    },
  ) {
    // スーパー管理者のみ作成可能
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('スーパー管理者のみ作成可能です');
    }

    return this.apiKeyService.create({
      name: body.name,
      permissions: body.permissions,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'APIキー更新' })
  async update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() body: {
      name?: string;
      permissions?: string[];
      isActive?: boolean;
      expiresAt?: string | null;
    },
  ) {
    // スーパー管理者のみ更新可能
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('スーパー管理者のみ更新可能です');
    }

    return this.apiKeyService.update(id, {
      name: body.name,
      permissions: body.permissions,
      isActive: body.isActive,
      expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'APIキー削除' })
  async delete(@Param('id') id: string, @Req() req: RequestWithUser) {
    // スーパー管理者のみ削除可能
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('スーパー管理者のみ削除可能です');
    }

    return this.apiKeyService.delete(id);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'APIキー再生成' })
  async regenerate(@Param('id') id: string, @Req() req: RequestWithUser) {
    // スーパー管理者のみ再生成可能
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('スーパー管理者のみ再生成可能です');
    }

    return this.apiKeyService.regenerate(id);
  }
}
