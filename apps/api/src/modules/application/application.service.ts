import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  /**
   * siteIdからアプリケーションを取得
   */
  async findBySiteId(siteId: string) {
    const app = await this.prisma.application.findUnique({
      where: { siteId, isActive: true },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    return app;
  }

  /**
   * IDからアプリケーションを取得
   */
  async findById(id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    return app;
  }

  /**
   * デフォルトアプリケーションを取得（後方互換用）
   */
  async getDefaultApplication() {
    const app = await this.prisma.application.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!app) {
      throw new NotFoundException('No application found');
    }
    return app;
  }

  /**
   * 管理者がアクセス可能なアプリケーション一覧を取得
   */
  async findByAdminId(adminId: string, role?: string) {
    // SUPER_ADMINはすべてのアプリにアクセス可能
    if (role === 'SUPER_ADMIN') {
      const apps = await this.prisma.application.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return apps.map((app) => ({
        ...app,
        role: 'owner',
      }));
    }

    const accesses = await this.prisma.adminApplicationAccess.findMany({
      where: { adminId },
      include: { application: true },
    });

    // アクセス権がない場合でもデフォルトアプリケーションを返す（後方互換）
    if (accesses.length === 0) {
      const defaultApp = await this.prisma.application.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (defaultApp) {
        return [{
          ...defaultApp,
          role: 'viewer',
        }];
      }
    }

    return accesses.map((a) => ({
      ...a.application,
      role: a.role,
    }));
  }

  /**
   * 全アプリケーション一覧（SUPER_ADMIN用）
   */
  async findAll() {
    return this.prisma.application.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * アプリケーション作成
   */
  async create(data: {
    name: string;
    domain?: string;
    description?: string;
    settings?: Prisma.InputJsonValue;
  }) {
    const siteId = this.generateSiteId();
    return this.prisma.application.create({
      data: {
        name: data.name,
        domain: data.domain,
        description: data.description,
        settings: data.settings,
        siteId,
        isActive: true,
      },
    });
  }

  /**
   * アプリケーション更新
   */
  async update(
    id: string,
    data: {
      name?: string;
      domain?: string;
      description?: string;
      settings?: Prisma.InputJsonValue;
      isActive?: boolean;
    },
  ) {
    return this.prisma.application.update({
      where: { id },
      data: {
        name: data.name,
        domain: data.domain,
        description: data.description,
        settings: data.settings,
        isActive: data.isActive,
      },
    });
  }

  /**
   * siteId再生成
   */
  async regenerateSiteId(id: string) {
    const newSiteId = this.generateSiteId();
    return this.prisma.application.update({
      where: { id },
      data: { siteId: newSiteId },
    });
  }

  /**
   * 管理者にアプリケーションへのアクセス権を付与
   */
  async grantAccess(applicationId: string, adminId: string, role: string = 'operator') {
    return this.prisma.adminApplicationAccess.upsert({
      where: {
        adminId_applicationId: { adminId, applicationId },
      },
      update: { role },
      create: { adminId, applicationId, role },
    });
  }

  /**
   * 管理者のアプリケーションアクセス権を削除
   */
  async revokeAccess(applicationId: string, adminId: string) {
    return this.prisma.adminApplicationAccess.delete({
      where: {
        adminId_applicationId: { adminId, applicationId },
      },
    });
  }

  /**
   * 管理者がアプリケーションにアクセス可能か確認
   */
  async hasAccess(adminId: string, applicationId: string): Promise<boolean> {
    const access = await this.prisma.adminApplicationAccess.findUnique({
      where: {
        adminId_applicationId: { adminId, applicationId },
      },
    });
    return !!access;
  }

  /**
   * siteId生成
   */
  private generateSiteId(): string {
    return `site_${crypto.randomBytes(16).toString('hex')}`;
  }
}
