import { IsString, IsOptional, IsEnum, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'こんにちは、お問い合わせありがとうございます。' })
  @IsString({ message: '内容は文字列である必要があります' })
  @MaxLength(5000, { message: '内容は5000文字以内である必要があります' })
  content: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE'], default: 'TEXT' })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE'], { message: 'contentTypeはTEXTまたはIMAGEである必要があります' })
  contentType?: 'TEXT' | 'IMAGE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'payloadはオブジェクトである必要があります' })
  payload?: Record<string, unknown>;
}

export class InternalMemoDto {
  @ApiProperty({ example: '要対応：クレーム案件' })
  @IsString({ message: '内容は文字列である必要があります' })
  @MaxLength(2000, { message: '内容は2000文字以内である必要があります' })
  content: string;
}
