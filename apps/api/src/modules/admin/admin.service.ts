import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const admins = await this.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        maxConcurrent: true,
        createdAt: true,
      },
    });

    // 各管理者の現在の対応数を取得
    const adminsWithActiveChats = await Promise.all(
      admins.map(async (admin) => {
        const activeChats = await this.prisma.conversation.count({
          where: {
            assignedAdminId: admin.id,
            status: 'HUMAN',
          },
        });
        return { ...admin, activeChats };
      }),
    );

    return adminsWithActiveChats;
  }

  async findById(id: string) {
    return this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        maxConcurrent: true,
        createdAt: true,
      },
    });
  }

  async create(data: {
    email: string;
    name: string;
    password: string;
    role?: AdminRole;
    maxConcurrent?: number;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.admin.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role || 'OPERATOR',
        maxConcurrent: data.maxConcurrent || 5,
        status: 'OFFLINE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        maxConcurrent: true,
        createdAt: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      email?: string;
      name?: string;
      password?: string;
      role?: AdminRole;
      maxConcurrent?: number;
    },
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.email) updateData.email = data.email;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.maxConcurrent !== undefined) updateData.maxConcurrent = data.maxConcurrent;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        maxConcurrent: true,
        createdAt: true,
      },
    });
  }

  async updateStatus(id: string, status: AdminStatus) {
    return this.prisma.admin.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.admin.delete({
      where: { id },
    });
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    // 現在のパスワードを確認
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: { passwordHash: true },
    });

    if (!admin) {
      return { success: false, message: 'ユーザーが見つかりません' };
    }

    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) {
      return { success: false, message: '現在のパスワードが正しくありません' };
    }

    // 新しいパスワードをハッシュ化して更新
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.admin.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'パスワードを変更しました' };
  }

  async getOnlineAdmins() {
    return this.prisma.admin.findMany({
      where: {
        status: { in: ['ONLINE', 'BUSY'] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        maxConcurrent: true,
      },
    });
  }
}
