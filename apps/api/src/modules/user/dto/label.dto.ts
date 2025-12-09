import { IsString, IsOptional, IsArray, IsUUID, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabelDto {
  @ApiProperty({ example: 'VIP顧客' })
  @IsString({ message: '名前は文字列である必要があります' })
  @MaxLength(50, { message: '名前は50文字以内である必要があります' })
  name: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString({ message: '色は文字列である必要があります' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: '色は#RRGGBB形式で入力してください' })
  color?: string;
}

export class UpdateLabelDto {
  @ApiPropertyOptional({ example: 'VIP顧客' })
  @IsOptional()
  @IsString({ message: '名前は文字列である必要があります' })
  @MaxLength(50, { message: '名前は50文字以内である必要があります' })
  name?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString({ message: '色は文字列である必要があります' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: '色は#RRGGBB形式で入力してください' })
  color?: string;
}

export class SetUserLabelsDto {
  @ApiProperty({ example: ['uuid1', 'uuid2'] })
  @IsArray({ message: 'labelIdsは配列である必要があります' })
  @IsUUID('4', { each: true, message: '有効なラベルIDを入力してください' })
  labelIds: string[];
}
