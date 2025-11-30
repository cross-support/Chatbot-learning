import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key[0] !== '$' && typeof (this as any)[key]?.deleteMany === 'function'
    );

    return Promise.all(
      models.map((modelKey) => (this as any)[modelKey].deleteMany())
    );
  }
}
