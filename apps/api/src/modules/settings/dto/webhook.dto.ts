import { IsString, IsUrl, IsArray, IsOptional, IsBoolean, MaxLength, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ example: '新規会話通知' })
  @IsString({ message: '名前は文字列である必要があります' })
  @MaxLength(100, { message: '名前は100文字以内である必要があります' })
  name: string;

  @ApiProperty({ example: 'https://example.com/webhook' })
  @IsUrl({}, { message: '有効なURLを入力してください' })
  @MaxLength(500, { message: 'URLは500文字以内である必要があります' })
  url: string;

  @ApiProperty({ example: ['conversation.created', 'message.received'] })
  @IsArray({ message: 'eventsは配列である必要があります' })
  @ArrayMinSize(1, { message: '少なくとも1つのイベントを選択してください' })
  @IsString({ each: true, message: 'イベントは文字列である必要があります' })
  events: string[];
}

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: '新規会話通知' })
  @IsOptional()
  @IsString({ message: '名前は文字列である必要があります' })
  @MaxLength(100, { message: '名前は100文字以内である必要があります' })
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/webhook' })
  @IsOptional()
  @IsUrl({}, { message: '有効なURLを入力してください' })
  @MaxLength(500, { message: 'URLは500文字以内である必要があります' })
  url?: string;

  @ApiPropertyOptional({ example: ['conversation.created', 'message.received'] })
  @IsOptional()
  @IsArray({ message: 'eventsは配列である必要があります' })
  @IsString({ each: true, message: 'イベントは文字列である必要があります' })
  events?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'isActiveはブール値である必要があります' })
  isActive?: boolean;
}
