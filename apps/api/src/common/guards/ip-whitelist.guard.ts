import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // メタデータでスキップ可能
    const skipIpWhitelist = this.reflector.get<boolean>(
      'skipIpWhitelist',
      context.getHandler(),
    );

    if (skipIpWhitelist) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const clientIp = this.extractIpAddress(request);

    this.logger.debug(`Checking IP whitelist for: ${clientIp}`);

    // IPホワイトリスト取得
    const whitelists = await this.prisma.ipWhitelist.findMany({
      where: { isEnabled: true },
    });

    if (whitelists.length === 0) {
      // ホワイトリストが設定されていない場合は許可
      this.logger.debug('No IP whitelist configured, allowing access');
      await this.logAccess(clientIp, null, true, 'no_whitelist_configured');
      return true;
    }

    // IPアドレスがホワイトリストに含まれているかチェック
    const isAllowed = whitelists.some((whitelist) =>
      this.isIpAllowed(clientIp, whitelist.ipAddress),
    );

    if (!isAllowed) {
      this.logger.warn(`IP address not whitelisted: ${clientIp}`);
      await this.logAccess(clientIp, null, false, 'not_whitelisted');
      throw new ForbiddenException('Access denied: IP address not whitelisted');
    }

    this.logger.debug(`IP address whitelisted: ${clientIp}`);
    await this.logAccess(clientIp, request.user?.id, true, 'whitelisted');

    return true;
  }

  /**
   * リクエストからIPアドレスを抽出
   */
  private extractIpAddress(request: any): string {
    // X-Forwarded-Forヘッダーをチェック（プロキシ経由の場合）
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // 最初のIPアドレスを取得
      return forwardedFor.split(',')[0].trim();
    }

    // X-Real-IPヘッダーをチェック
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // デフォルトでrequest.ipを使用
    return request.ip || request.connection.remoteAddress || 'unknown';
  }

  /**
   * IPアドレスがホワイトリストに含まれているかチェック
   */
  private isIpAllowed(clientIp: string, whitelistIp: string): boolean {
    // 完全一致
    if (clientIp === whitelistIp) {
      return true;
    }

    // CIDR表記のチェック
    if (whitelistIp.includes('/')) {
      return this.isIpInCidr(clientIp, whitelistIp);
    }

    // ワイルドカードのチェック（例: 192.168.1.*）
    if (whitelistIp.includes('*')) {
      const pattern = whitelistIp.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(clientIp);
    }

    return false;
  }

  /**
   * IPアドレスがCIDR範囲内にあるかチェック
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * IPアドレスを数値に変換
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * IPアクセスログを記録
   */
  private async logAccess(
    ipAddress: string,
    adminId: string | null,
    allowed: boolean,
    reason: string,
  ): Promise<void> {
    try {
      await this.prisma.ipAccessLog.create({
        data: {
          ipAddress,
          adminId,
          allowed,
          reason,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log IP access', error);
    }
  }
}
