import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ipaddr from 'ipaddr.js';

@Injectable()
export class IpWhitelistService {
  private readonly logger = new Logger(IpWhitelistService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * IPホワイトリストを追加
   */
  async addIp(ipAddress: string, description?: string) {
    // IPアドレス/CIDRの形式を検証
    this.validateIpOrCidr(ipAddress);

    return this.prisma.ipWhitelist.create({
      data: {
        ipAddress,
        description,
      },
    });
  }

  /**
   * IPホワイトリスト一覧を取得
   */
  async getWhitelist() {
    return this.prisma.ipWhitelist.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * IPホワイトリストを更新
   */
  async updateIp(id: string, data: { description?: string; isEnabled?: boolean }) {
    return this.prisma.ipWhitelist.update({
      where: { id },
      data,
    });
  }

  /**
   * IPホワイトリストから削除
   */
  async removeIp(id: string) {
    return this.prisma.ipWhitelist.delete({
      where: { id },
    });
  }

  /**
   * IPアドレスがホワイトリストに含まれるか確認
   */
  async isIpAllowed(clientIp: string): Promise<boolean> {
    const whitelist = await this.prisma.ipWhitelist.findMany({
      where: { isEnabled: true },
    });

    // ホワイトリストが空の場合は全て許可
    if (whitelist.length === 0) {
      return true;
    }

    const parsedClientIp = this.parseIp(clientIp);
    if (!parsedClientIp) {
      this.logger.warn(`Invalid client IP: ${clientIp}`);
      return false;
    }

    for (const entry of whitelist) {
      if (this.matchIp(parsedClientIp, entry.ipAddress)) {
        return true;
      }
    }

    return false;
  }

  /**
   * IPアクセスをチェックし、ログを記録
   */
  async checkAndLogAccess(clientIp: string, adminId?: string): Promise<boolean> {
    const allowed = await this.isIpAllowed(clientIp);

    await this.prisma.ipAccessLog.create({
      data: {
        ipAddress: clientIp,
        adminId,
        allowed,
        reason: allowed ? 'whitelisted' : 'blocked',
      },
    });

    if (!allowed) {
      this.logger.warn(`Blocked IP access: ${clientIp}, adminId: ${adminId}`);
    }

    return allowed;
  }

  /**
   * アクセスを検証（許可されていなければ例外）
   */
  async validateAccess(clientIp: string, adminId?: string): Promise<void> {
    const allowed = await this.checkAndLogAccess(clientIp, adminId);
    if (!allowed) {
      throw new ForbiddenException('このIPアドレスからのアクセスは許可されていません');
    }
  }

  /**
   * アクセスログを取得
   */
  async getAccessLogs(params: {
    ipAddress?: string;
    adminId?: string;
    allowed?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (params.ipAddress) where.ipAddress = params.ipAddress;
    if (params.adminId) where.adminId = params.adminId;
    if (params.allowed !== undefined) where.allowed = params.allowed;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }

    return this.prisma.ipAccessLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 100,
    });
  }

  /**
   * ブロック統計を取得
   */
  async getBlockStats(startDate?: Date, endDate?: Date) {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [total, blocked, allowed] = await Promise.all([
      this.prisma.ipAccessLog.count({ where }),
      this.prisma.ipAccessLog.count({ where: { ...where, allowed: false } }),
      this.prisma.ipAccessLog.count({ where: { ...where, allowed: true } }),
    ]);

    // ブロックされたIPの上位
    const topBlockedIps = await this.prisma.ipAccessLog.groupBy({
      by: ['ipAddress'],
      where: { ...where, allowed: false },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return {
      total,
      blocked,
      allowed,
      blockRate: total > 0 ? ((blocked / total) * 100).toFixed(2) : 0,
      topBlockedIps: topBlockedIps.map((ip) => ({
        ipAddress: ip.ipAddress,
        count: ip._count.id,
      })),
    };
  }

  // ===== プライベートメソッド =====

  private validateIpOrCidr(input: string) {
    try {
      if (input.includes('/')) {
        // CIDR表記
        ipaddr.parseCIDR(input);
      } else {
        ipaddr.parse(input);
      }
    } catch {
      throw new Error(`無効なIPアドレスまたはCIDR表記です: ${input}`);
    }
  }

  private parseIp(ip: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
    try {
      // IPv4-mapped IPv6 (::ffff:192.168.1.1) をIPv4に変換
      const parsed = ipaddr.parse(ip);
      if (parsed.kind() === 'ipv6') {
        const ipv6 = parsed as ipaddr.IPv6;
        if (ipv6.isIPv4MappedAddress()) {
          return ipv6.toIPv4Address();
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private matchIp(clientIp: ipaddr.IPv4 | ipaddr.IPv6, whitelistEntry: string): boolean {
    try {
      if (whitelistEntry.includes('/')) {
        // CIDR表記
        const [range, prefixLength] = ipaddr.parseCIDR(whitelistEntry);
        return clientIp.match(range, prefixLength);
      } else {
        // 単一IP
        const entryIp = ipaddr.parse(whitelistEntry);
        return clientIp.toString() === entryIp.toString();
      }
    } catch {
      return false;
    }
  }
}
