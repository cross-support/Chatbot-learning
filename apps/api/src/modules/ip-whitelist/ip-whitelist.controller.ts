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
import { IpWhitelistService } from './ip-whitelist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/ip-whitelist')
@UseGuards(JwtAuthGuard)
export class IpWhitelistController {
  constructor(private readonly ipWhitelistService: IpWhitelistService) {}

  @Post()
  async addIp(@Body() body: { ipAddress: string; description?: string }) {
    return this.ipWhitelistService.addIp(body.ipAddress, body.description);
  }

  @Get()
  async getWhitelist() {
    return this.ipWhitelistService.getWhitelist();
  }

  @Put(':id')
  async updateIp(
    @Param('id') id: string,
    @Body() body: { description?: string; isEnabled?: boolean },
  ) {
    return this.ipWhitelistService.updateIp(id, body);
  }

  @Delete(':id')
  async removeIp(@Param('id') id: string) {
    return this.ipWhitelistService.removeIp(id);
  }

  @Get('logs')
  async getAccessLogs(
    @Query('ipAddress') ipAddress?: string,
    @Query('adminId') adminId?: string,
    @Query('allowed') allowed?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ipWhitelistService.getAccessLogs({
      ipAddress,
      adminId,
      allowed: allowed !== undefined ? allowed === 'true' : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  async getBlockStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ipWhitelistService.getBlockStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
