import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('templates')
@Controller('api/templates')
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'テンプレート一覧取得' })
  async findAll(@Query('includeInactive') includeInactive?: string) {
    if (includeInactive === 'true') {
      return this.templateService.findAllIncludingInactive();
    }
    return this.templateService.findAll();
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'カテゴリ一覧取得' })
  async getCategories() {
    return this.templateService.getCategories();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'テンプレート詳細取得' })
  async findById(@Param('id') id: string) {
    return this.templateService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'テンプレート作成' })
  async create(
    @Body()
    body: {
      code: string;
      name: string;
      content: string;
      category?: string;
      order?: number;
    },
  ) {
    return this.templateService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'テンプレート更新' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      content?: string;
      category?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.templateService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'テンプレート削除' })
  async delete(@Param('id') id: string) {
    return this.templateService.delete(id);
  }
}
