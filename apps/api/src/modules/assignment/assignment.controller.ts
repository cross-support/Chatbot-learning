import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('assignment')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  // ===== ルール管理 =====

  @Post('rules')
  async createRule(
    @Body()
    body: {
      name: string;
      priority?: number;
      conditions: Record<string, unknown>;
      targetType: 'admin' | 'team' | 'round_robin';
      targetId?: string;
    },
  ) {
    return this.assignmentService.createRule(body as Parameters<typeof this.assignmentService.createRule>[0]);
  }

  @Get('rules')
  async getRules() {
    return this.assignmentService.getRules();
  }

  @Put('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.assignmentService.updateRule(id, body as Parameters<typeof this.assignmentService.updateRule>[1]);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.assignmentService.deleteRule(id);
  }

  // ===== 自動割り当て =====

  @Post('assign/:conversationId')
  async assignConversation(@Param('conversationId') conversationId: string) {
    const adminId = await this.assignmentService.assignConversation(conversationId);
    return { success: !!adminId, adminId };
  }

  // ===== スキル管理 =====

  @Post('skills/:adminId')
  async setSkill(
    @Param('adminId') adminId: string,
    @Body() body: { skill: string; level: number },
  ) {
    return this.assignmentService.setAdminSkill(adminId, body.skill, body.level);
  }

  @Get('skills/:adminId')
  async getSkills(@Param('adminId') adminId: string) {
    return this.assignmentService.getAdminSkills(adminId);
  }

  @Delete('skills/:adminId/:skill')
  async removeSkill(
    @Param('adminId') adminId: string,
    @Param('skill') skill: string,
  ) {
    return this.assignmentService.removeAdminSkill(adminId, skill);
  }

  @Get('admins/available')
  async getAvailableAdmins() {
    return this.assignmentService.getAvailableAdmins();
  }

  @Get('admins/by-skill/:skill')
  async getAdminsBySkill(@Param('skill') skill: string) {
    return this.assignmentService.getAdminsBySkill(skill);
  }
}
