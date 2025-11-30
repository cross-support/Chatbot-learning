import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上である必要があります' })
  password: string;
}
