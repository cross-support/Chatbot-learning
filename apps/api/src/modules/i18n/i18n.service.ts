import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class I18nService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(locale?: string, namespace?: string) {
    const where: any = {};
    if (locale) where.locale = locale;
    if (namespace) where.namespace = namespace;

    return this.prisma.translation.findMany({
      where,
      orderBy: [
        { locale: 'asc' },
        { namespace: 'asc' },
        { key: 'asc' },
      ],
    });
  }

  async getByLocale(locale: string) {
    const translations = await this.prisma.translation.findMany({
      where: { locale },
      orderBy: [
        { namespace: 'asc' },
        { key: 'asc' },
      ],
    });

    const grouped: Record<string, Record<string, string>> = {};
    translations.forEach((t: { namespace: string; key: string; value: string }) => {
      if (!grouped[t.namespace]) {
        grouped[t.namespace] = {};
      }
      grouped[t.namespace][t.key] = t.value;
    });

    return grouped;
  }

  async getByLocaleAndNamespace(locale: string, namespace: string) {
    const translations = await this.prisma.translation.findMany({
      where: { locale, namespace },
      orderBy: { key: 'asc' },
    });

    const result: Record<string, string> = {};
    translations.forEach((t: { key: string; value: string }) => {
      result[t.key] = t.value;
    });

    return result;
  }

  async create(createDto: {
    locale: string;
    namespace: string;
    key: string;
    value: string;
  }) {
    const existing = await this.prisma.translation.findUnique({
      where: {
        locale_namespace_key: {
          locale: createDto.locale,
          namespace: createDto.namespace,
          key: createDto.key,
        },
      },
    });

    if (existing) {
      return this.prisma.translation.update({
        where: { id: existing.id },
        data: { value: createDto.value },
      });
    }

    return this.prisma.translation.create({
      data: createDto,
    });
  }

  async update(id: string, updateDto: { value: string }) {
    const translation = await this.prisma.translation.findUnique({
      where: { id },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    return this.prisma.translation.update({
      where: { id },
      data: updateDto,
    });
  }

  async delete(id: string) {
    const translation = await this.prisma.translation.findUnique({
      where: { id },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    return this.prisma.translation.delete({
      where: { id },
    });
  }
}
