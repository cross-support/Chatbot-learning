import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ScenarioService } from './scenario.service';
import { ScenarioParserService } from './scenario-parser.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('scenarios')
@Controller('api/scenarios')
export class ScenarioController {
  constructor(
    private scenarioService: ScenarioService,
    private scenarioParserService: ScenarioParserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'シナリオツリー取得' })
  async getTree() {
    return this.scenarioService.getFullTree();
  }

  @Get('initial')
  @ApiOperation({ summary: '初期選択肢取得' })
  async getInitialOptions() {
    return this.scenarioService.getInitialOptions();
  }

  @Get(':id/children')
  @ApiOperation({ summary: '子ノード取得' })
  async getChildren(@Param('id') id: string) {
    return this.scenarioService.getChildren(Number(id));
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'CSVインポート' })
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { success: false, error: 'ファイルが見つかりません' };
    }

    const csvContent = file.buffer.toString('utf-8');
    const result = await this.scenarioParserService.importFromCsv(csvContent);

    return {
      success: result.errors.length === 0,
      imported: result.imported,
      errors: result.errors,
    };
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'CSVエクスポート' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.scenarioParserService.exportToCsv();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=scenarios.csv');
    res.send('\uFEFF' + csv); // BOM付きUTF-8
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ノード作成' })
  async createNode(
    @Body()
    body: {
      parentId?: number;
      level: number;
      triggerText: string;
      responseText?: string;
      action?: string;
      actionValue?: string;
      order?: number;
    },
  ) {
    return this.scenarioService.createNode(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ノード更新' })
  async updateNode(
    @Param('id') id: string,
    @Body()
    body: {
      triggerText?: string;
      responseText?: string;
      action?: string;
      actionValue?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.scenarioService.updateNode(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ノード削除' })
  async deleteNode(@Param('id') id: string) {
    return this.scenarioService.deleteNode(Number(id));
  }
}
