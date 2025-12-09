import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RichMessageService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(type?: string, active?: string) {
    const where: any = {};
    if (type) where.type = type;
    if (active === 'true') where.isActive = true;
    else if (active === 'false') where.isActive = false;

    return this.prisma.richMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const richMessage = await this.prisma.richMessage.findUnique({
      where: { id },
    });
    if (!richMessage) {
      throw new NotFoundException('Rich message not found');
    }
    return richMessage;
  }

  async create(createDto: {
    type: string;
    name: string;
    content: any;
    isActive?: boolean;
  }) {
    this.validateContent(createDto.type, createDto.content);
    return this.prisma.richMessage.create({
      data: {
        type: createDto.type,
        name: createDto.name,
        content: createDto.content,
        isActive: createDto.isActive ?? true,
      },
    });
  }

  async update(id: string, updateDto: {
    type?: string;
    name?: string;
    content?: any;
    isActive?: boolean;
  }) {
    const richMessage = await this.getById(id);
    if (updateDto.content) {
      const type = updateDto.type || richMessage.type;
      this.validateContent(type, updateDto.content);
    }
    return this.prisma.richMessage.update({
      where: { id },
      data: updateDto,
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.prisma.richMessage.delete({ where: { id } });
  }

  private validateContent(type: string, content: any) {
    switch (type) {
      case 'carousel':
        if (!Array.isArray(content.items) || content.items.length === 0) {
          throw new Error('Carousel must have at least one item');
        }
        content.items.forEach((item: any, index: number) => {
          if (!item.title) throw new Error(`Carousel item ${index} must have a title`);
          if (!Array.isArray(item.buttons)) throw new Error(`Carousel item ${index} must have buttons array`);
        });
        break;
      case 'quick_reply':
        if (!Array.isArray(content.options) || content.options.length === 0) {
          throw new Error('Quick reply must have at least one option');
        }
        content.options.forEach((option: any, index: number) => {
          if (!option.label || !option.action || !option.value) {
            throw new Error(`Quick reply option ${index} must have label, action, and value`);
          }
        });
        break;
      case 'button':
        if (!content.text) throw new Error('Button template must have text');
        if (!Array.isArray(content.buttons) || content.buttons.length === 0) {
          throw new Error('Button template must have at least one button');
        }
        content.buttons.forEach((button: any, index: number) => {
          if (!button.label || !button.action || !button.value) {
            throw new Error(`Button ${index} must have label, action, and value`);
          }
        });
        break;
      case 'image_map':
        if (!content.imageUrl) throw new Error('Image map must have an image URL');
        if (!Array.isArray(content.areas)) throw new Error('Image map must have areas array');
        content.areas.forEach((area: any, index: number) => {
          if (!area.x || !area.y || !area.width || !area.height) {
            throw new Error(`Image map area ${index} must have x, y, width, and height`);
          }
          if (!area.action || !area.value) {
            throw new Error(`Image map area ${index} must have action and value`);
          }
        });
        break;
      default:
        throw new Error(`Unknown rich message type: ${type}`);
    }
  }
}
