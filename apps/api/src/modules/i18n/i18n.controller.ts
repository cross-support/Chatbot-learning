import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { I18nService } from './i18n.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get()
  async getAll(
    @Query('locale') locale?: string,
    @Query('namespace') namespace?: string,
  ) {
    return this.i18nService.getAll(locale, namespace);
  }

  @Get(':locale')
  async getByLocale(@Param('locale') locale: string) {
    return this.i18nService.getByLocale(locale);
  }

  @Get(':locale/:namespace')
  async getByLocaleAndNamespace(
    @Param('locale') locale: string,
    @Param('namespace') namespace: string,
  ) {
    return this.i18nService.getByLocaleAndNamespace(locale, namespace);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body()
    createDto: {
      locale: string;
      namespace: string;
      key: string;
      value: string;
    },
  ) {
    return this.i18nService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: { value: string },
  ) {
    return this.i18nService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.i18nService.delete(id);
  }
}
