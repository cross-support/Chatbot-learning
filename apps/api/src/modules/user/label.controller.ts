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
import { LabelService } from './label.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('labels')
@Controller('api/labels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LabelController {
  constructor(private labelService: LabelService) {}

  @Get()
  @ApiOperation({ summary: 'ラベル一覧取得' })
  async findAll() {
    return this.labelService.findAllLabels();
  }

  @Get(':id')
  @ApiOperation({ summary: 'ラベル詳細取得' })
  async findById(@Param('id') id: string) {
    return this.labelService.findLabelById(id);
  }

  @Post()
  @ApiOperation({ summary: 'ラベル作成' })
  async create(@Body() body: { name: string; color?: string }) {
    return this.labelService.createLabel(body.name, body.color);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ラベル更新' })
  async update(@Param('id') id: string, @Body() body: { name?: string; color?: string }) {
    return this.labelService.updateLabel(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ラベル削除' })
  async delete(@Param('id') id: string) {
    return this.labelService.deleteLabel(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'ラベルが付いたユーザー一覧取得' })
  async getUsersByLabel(@Param('id') id: string) {
    return this.labelService.findUsersByLabel(id);
  }
}
