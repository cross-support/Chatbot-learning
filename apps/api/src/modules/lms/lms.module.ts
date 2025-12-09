import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LmsService } from './lms.service';
import { LmsController } from './lms.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [LmsService],
  controllers: [LmsController],
  exports: [LmsService],
})
export class LmsModule {}
