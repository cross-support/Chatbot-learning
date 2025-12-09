import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Res, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ScenarioService, ScenarioResponse } from './scenario.service';
import { ScenarioParserService } from './scenario-parser.service';
import { EvaParserService } from './eva-parser.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('scenarios')
@Controller('api/scenarios')
export class ScenarioController {
  constructor(
    private scenarioService: ScenarioService,
    private scenarioParserService: ScenarioParserService,
    private evaParserService: EvaParserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'シナリオツリー取得' })
  async getTree() {
    return this.scenarioService.getFullTree();
  }

  @Get('initial')
  @ApiOperation({ summary: '初期選択肢取得' })
  @ApiQuery({ name: 'role', required: false, enum: ['learner', 'group_admin', 'global_admin'], description: 'ユーザーロール' })
  async getInitialOptions(@Query('role') role?: string): Promise<ScenarioResponse> {
    return this.scenarioService.getInitialOptions(role || 'learner');
  }

  @Get('list')
  @ApiOperation({ summary: 'シナリオ一覧取得' })
  async getScenarioList() {
    return this.evaParserService.getScenarios();
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

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'eva'], description: 'インポート形式' })
  @ApiQuery({ name: 'name', required: false, description: 'シナリオ名（EVA形式のみ）' })
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
  @ApiOperation({ summary: 'シナリオインポート（CSV/EVA JSON）' })
  async importScenario(
    @UploadedFile() file: Express.Multer.File,
    @Query('format') format?: string,
    @Query('name') name?: string,
  ) {
    if (!file) {
      return { success: false, error: 'ファイルが見つかりません' };
    }

    const content = file.buffer.toString('utf-8');
    const importFormat = format || (file.originalname.endsWith('.json') ? 'eva' : 'csv');

    if (importFormat === 'eva') {
      // EVA JSON形式
      const scenarioName = name || file.originalname.replace(/\.[^/.]+$/, '') || 'Imported Scenario';
      const result = await this.evaParserService.importFromEvaJson(content, scenarioName);
      return {
        success: result.errors.length === 0,
        imported: result.imported,
        scenarioId: result.scenarioId,
        errors: result.errors,
      };
    } else {
      // CSV形式（従来）
      const result = await this.scenarioParserService.importFromCsv(content);
      return {
        success: result.errors.length === 0,
        imported: result.imported,
        errors: result.errors,
      };
    }
  }

  // エディタ用シナリオAPI（/scenario/xxx）- :id より前に配置
  @Post('scenario')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新規シナリオ作成（エディタ用）' })
  async createScenario(
    @Body() body: {
      name: string;
      targetRole?: string; // "learner", "group_admin", "global_admin" - null/undefinedは全員対象
      nodes?: Array<{
        id: string;
        type: string;
        content: string;
        metadata: string;
      }>;
      connections?: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        sourceHandle?: string;
      }>;
    },
  ) {
    return this.evaParserService.createScenarioFromEditor(body);
  }

  @Get('scenario/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'シナリオ詳細取得（エディタ用）' })
  async getScenario(@Param('id') id: string) {
    const scenario = await this.evaParserService.getScenarioWithNodes(id);
    if (!scenario) {
      return { error: 'シナリオが見つかりません' };
    }
    return scenario;
  }

  @Put('scenario/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'シナリオ更新（エディタ用）' })
  async updateScenario(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      targetRole?: string | null; // "learner", "group_admin", "global_admin" - nullは全員対象
      nodes?: Array<{
        id: string;
        type: string;
        content: string;
        metadata: string;
      }>;
      connections?: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        sourceHandle?: string;
      }>;
    },
  ) {
    return this.evaParserService.updateScenarioFromEditor(id, body);
  }

  @Delete('scenario/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'シナリオ削除' })
  async deleteScenario(@Param('id') id: string) {
    return this.evaParserService.deleteScenario(id);
  }

  // パラメータ付きルート（:id）- 最後に配置
  @Get(':id/children')
  @ApiOperation({ summary: '子ノード取得' })
  async getChildren(@Param('id') id: string) {
    return this.scenarioService.getChildren(Number(id));
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
