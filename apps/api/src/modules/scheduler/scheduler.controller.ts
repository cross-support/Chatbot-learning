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
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('scheduler')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('tasks')
  async createTask(
    @Body()
    body: {
      name: string;
      taskType: string;
      cronExpression: string;
      config?: Record<string, unknown>;
    },
  ) {
    return this.schedulerService.createTask(body);
  }

  @Get('tasks')
  async getTasks() {
    return this.schedulerService.getTasks();
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      cronExpression?: string;
      config?: Record<string, unknown>;
      isEnabled?: boolean;
    },
  ) {
    return this.schedulerService.updateTask(id, body);
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string) {
    return this.schedulerService.deleteTask(id);
  }

  @Post('tasks/:id/run')
  async runTask(@Param('id') id: string) {
    return this.schedulerService.runTaskManually(id);
  }

  @Get('logs')
  async getLogs(
    @Query('taskId') taskId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schedulerService.getTaskLogs(
      taskId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
