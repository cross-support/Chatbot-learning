import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    // ステータスをオンラインに更新
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { status: 'ONLINE' },
    });

    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: 'ONLINE',
      },
    };
  }

  async logout(adminId: string) {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { status: 'OFFLINE' },
    });

    return { message: 'ログアウトしました' };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
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

    if (!admin) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    return admin;
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const { email, password, name, role } = createAdminDto;

    const existingAdmin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      throw new UnauthorizedException('このメールアドレスは既に登録されています');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'OPERATOR',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return admin;
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch {
      throw new UnauthorizedException('無効なトークンです');
    }
  }
}
