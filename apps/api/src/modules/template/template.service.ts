import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.template.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  async findAllIncludingInactive() {
    return this.prisma.template.findMany({
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  async findById(id: string) {
    return this.prisma.template.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string) {
    return this.prisma.template.findUnique({
      where: { code },
    });
  }

  async findByCategory(category: string) {
    return this.prisma.template.findMany({
      where: { category, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async create(data: {
    code: string;
    name: string;
    content: string;
    category?: string;
    order?: number;
  }) {
    return this.prisma.template.create({
      data: {
        code: data.code,
        name: data.name,
        content: data.content,
        category: data.category,
        order: data.order ?? 0,
      },
    });
  }

  async update(
    id: string,
    data: {
      code?: string;
      name?: string;
      content?: string;
      category?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.template.delete({
      where: { id },
    });
  }

  async getCategories() {
    const result = await this.prisma.template.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: true,
    });
    return result.map((r) => ({
      category: r.category || '未分類',
      count: r._count,
    }));
  }
}
