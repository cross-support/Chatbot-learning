import { IsString, IsOptional, IsBoolean, IsObject, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: '外部連携用キー' })
  @IsString({ message: '名前は文字列である必要があります' })
  @MaxLength(100, { message: '名前は100文字以内である必要があります' })
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'permissionsはオブジェクトである必要があります' })
  permissions?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString({}, { message: '有効な日時を入力してください' })
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ example: '外部連携用キー' })
  @IsOptional()
  @IsString({ message: '名前は文字列である必要があります' })
  @MaxLength(100, { message: '名前は100文字以内である必要があります' })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'permissionsはオブジェクトである必要があります' })
  permissions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'isActiveはブール値である必要があります' })
  isActive?: boolean;
}
