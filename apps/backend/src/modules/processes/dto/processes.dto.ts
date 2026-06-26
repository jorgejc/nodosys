import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ProcessType, ProcessStatus } from '../entities/process.entity';

export class CreateProcessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProcessType)
  @IsOptional()
  type?: ProcessType;

  @IsUUID('loose' as any)
  @IsOptional()
  nodoId?: string;

  @IsUUID('loose' as any)
  @IsOptional()
  workPlanTaskId?: string;
}

export class UpdateProcessDto extends PartialType(CreateProcessDto) {
  @IsEnum(ProcessStatus)
  @IsOptional()
  status?: ProcessStatus;
}
