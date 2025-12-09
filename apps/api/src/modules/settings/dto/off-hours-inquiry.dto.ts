import { IsString, IsEmail, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOffHoursInquiryDto {
  @ApiProperty({ example: '山田太郎' })
  @IsString({ message: '氏名は文字列である必要があります' })
  @MinLength(1, { message: '氏名を入力してください' })
  @MaxLength(100, { message: '氏名は100文字以内である必要があります' })
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  @MaxLength(255, { message: 'メールアドレスは255文字以内である必要があります' })
  email: string;

  @ApiPropertyOptional({ example: '株式会社サンプル' })
  @IsOptional()
  @IsString({ message: '会社名は文字列である必要があります' })
  @MaxLength(100, { message: '会社名は100文字以内である必要があります' })
  company?: string;

  @ApiProperty({ example: 'ログインができません。パスワードを忘れてしまいました。' })
  @IsString({ message: '内容は文字列である必要があります' })
  @MinLength(10, { message: '内容は10文字以上入力してください' })
  @MaxLength(3000, { message: '内容は3000文字以内である必要があります' })
  content: string;
}

export class UpdateOffHoursInquiryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'] })
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'メモは文字列である必要があります' })
  @MaxLength(2000, { message: 'メモは2000文字以内である必要があります' })
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedAdminId?: string;
}
