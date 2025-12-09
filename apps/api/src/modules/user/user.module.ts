import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { LabelService } from './label.service';
import { UserController } from './user.controller';
import { LabelController } from './label.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UserService, LabelService],
  controllers: [UserController, LabelController],
  exports: [UserService, LabelService],
})
export class UserModule {}
