import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上である必要があります' })
  password: string;

  @ApiProperty({ example: '山田太郎' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'OPERATOR', enum: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] })
  @IsOptional()
  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR'], { message: '有効なロールを選択してください' })
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
}
