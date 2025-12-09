import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const adminUser = request.user; // From JWT guard

    // CRUD操作のマッピング
    const actionMap: Record<string, string> = {
      POST: 'create',
      PATCH: 'update',
      PUT: 'update',
      DELETE: 'delete',
      GET: 'read',
    };

    const action = actionMap[method];
    if (!action) {
      return next.handle();
    }

    // エンティティ名を推測（URLから）
    const entity = this.extractEntityFromUrl(url);
    const entityId = this.extractEntityIdFromUrl(url);

    return next.handle().pipe(
      tap((response) => {
        // レスポンス後にログ記録
        if (adminUser && entity) {
          this.auditService.log(
            action,
            entity,
            {
              adminId: adminUser.id,
              adminEmail: adminUser.email,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
            },
            {
              entityId: entityId ?? undefined,
              oldValue: method === 'PATCH' || method === 'PUT' ? request.body : undefined,
              newValue: response,
            },
          );
        }
      }),
    );
  }

  private extractEntityFromUrl(url: string): string | null {
    // URLから エンティティ名を抽出
    // 例: /api/conversations/123 -> conversation
    // 例: /api/templates -> template
    const match = url.match(/\/api\/([^\/\?]+)/);
    if (match && match[1]) {
      // 複数形を単数形に変換（簡易版）
      let entity = match[1];
      if (entity.endsWith('s')) {
        entity = entity.slice(0, -1);
      }
      return entity;
    }
    return null;
  }

  private extractEntityIdFromUrl(url: string): string | null {
    // URLからIDを抽出
    // 例: /api/conversations/123 -> 123
    const match = url.match(/\/([a-f0-9-]+)(?:\?|$)/);
    return match ? match[1] : null;
  }
}
