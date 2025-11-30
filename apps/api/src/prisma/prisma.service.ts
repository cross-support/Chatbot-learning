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
      (key) => {
        const keyStr = typeof key === 'string' ? key : '';
        return keyStr[0] !== '_' && keyStr[0] !== '$' && typeof (this as Record<string, unknown>)[keyStr as string] === 'object';
      }
    );

    return Promise.all(
      models
        .filter((modelKey) => {
          const model = (this as Record<string, unknown>)[modelKey as string];
          return model && typeof model === 'object' && 'deleteMany' in model;
        })
        .map((modelKey) => ((this as Record<string, unknown>)[modelKey as string] as { deleteMany: () => Promise<unknown> }).deleteMany())
    );
  }
}
