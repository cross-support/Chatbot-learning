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
  Request,
} from '@nestjs/common';
import { SnippetService } from './snippet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('snippets')
@UseGuards(JwtAuthGuard)
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Post()
  async create(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      title: string;
      content: string;
      shortcut?: string;
      category?: string;
      isShared?: boolean;
    },
  ) {
    return this.snippetService.createSnippet({
      ...body,
      adminId: req.user.id,
    });
  }

  @Get()
  async getAll(
    @Request() req: { user: { id: string } },
    @Query('category') category?: string,
  ) {
    return this.snippetService.getSnippets(req.user.id, category);
  }

  @Get('search')
  async search(
    @Request() req: { user: { id: string } },
    @Query('q') query: string,
  ) {
    return this.snippetService.searchSnippets(query, req.user.id);
  }

  @Get('shortcut/:shortcut')
  async findByShortcut(
    @Request() req: { user: { id: string } },
    @Param('shortcut') shortcut: string,
  ) {
    const snippet = await this.snippetService.findByShortcut(shortcut, req.user.id);
    if (snippet) {
      await this.snippetService.incrementUsage(snippet.id);
    }
    return snippet;
  }

  @Get('categories')
  async getCategories(@Request() req: { user: { id: string } }) {
    return this.snippetService.getCategories(req.user.id);
  }

  @Get('top')
  async getTop(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.snippetService.getTopSnippets(
      req.user.id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('shared')
  async getShared() {
    return this.snippetService.getSharedSnippets();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.snippetService.getSnippet(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      shortcut?: string;
      category?: string;
      isShared?: boolean;
    },
  ) {
    return this.snippetService.updateSnippet(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.snippetService.deleteSnippet(id);
  }

  @Post(':id/use')
  async use(@Param('id') id: string) {
    return this.snippetService.incrementUsage(id);
  }
}
