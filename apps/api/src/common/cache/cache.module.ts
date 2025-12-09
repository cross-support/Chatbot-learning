import { Global, Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CacheService, setupCacheCleanup, stopCacheCleanup } from './cache.service';

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly cacheService: CacheService) {}

  onModuleInit() {
    // 1分ごとにキャッシュクリーンアップ
    setupCacheCleanup(this.cacheService, 60000);
  }

  onModuleDestroy() {
    stopCacheCleanup();
  }
}
