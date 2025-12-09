import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limitは整数である必要があります' })
  @Min(1, { message: 'limitは1以上である必要があります' })
  @Max(100, { message: 'limitは100以下である必要があります' })
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offsetは整数である必要があります' })
  @Min(0, { message: 'offsetは0以上である必要があります' })
  offset?: number = 0;
}
