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
import { RichMessageService } from './rich-message.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/rich-messages')
@UseGuards(JwtAuthGuard)
export class RichMessageController {
  constructor(private readonly richMessageService: RichMessageService) {}

  @Get()
  async getAll(@Query('type') type?: string, @Query('active') active?: string) {
    return this.richMessageService.getAll(type, active);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.richMessageService.getById(id);
  }

  @Post()
  async create(
    @Body()
    createDto: {
      type: string;
      name: string;
      content: any;
      isActive?: boolean;
    },
  ) {
    return this.richMessageService.create(createDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    updateDto: {
      type?: string;
      name?: string;
      content?: any;
      isActive?: boolean;
    },
  ) {
    return this.richMessageService.update(id, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.richMessageService.delete(id);
  }
}
