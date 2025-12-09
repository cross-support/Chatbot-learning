import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApplicationService } from './application.service';

@ApiTags('applications')
@Controller('api/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'アプリケーション一覧取得' })
  async findAll(@Request() req: { user: { id: string; role: string } }) {
    if (req.user.role === 'SUPER_ADMIN') {
      return this.applicationService.findAll();
    }
    return this.applicationService.findByAdminId(req.user.id);
  }

  @Get('my-apps')
  @ApiOperation({ summary: '自分がアクセス可能なアプリケーション一覧' })
  async findMyApps(@Request() req: { user: { id: string; role: string } }) {
    return this.applicationService.findByAdminId(req.user.id, req.user.role);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'アプリケーション詳細取得' })
  async findOne(@Param('id') id: string) {
    return this.applicationService.findById(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'アプリケーション作成' })
  async create(
    @Body()
    body: {
      name: string;
      domain?: string;
      description?: string;
      settings?: Prisma.InputJsonValue;
    },
  ) {
    return this.applicationService.create(body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'アプリケーション更新' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      domain?: string;
      description?: string;
      settings?: Prisma.InputJsonValue;
      isActive?: boolean;
    },
  ) {
    return this.applicationService.update(id, body);
  }

  @Post(':id/regenerate-site-id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'siteID再生成' })
  async regenerateSiteId(@Param('id') id: string) {
    return this.applicationService.regenerateSiteId(id);
  }

  @Post(':id/access')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: '管理者にアクセス権付与' })
  async grantAccess(
    @Param('id') id: string,
    @Body() body: { adminId: string; role?: string },
  ) {
    return this.applicationService.grantAccess(id, body.adminId, body.role);
  }

  @Delete(':id/access/:adminId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: '管理者のアクセス権削除' })
  async revokeAccess(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
  ) {
    return this.applicationService.revokeAccess(id, adminId);
  }
}
