import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// DTO para el body del POST /auth/login
export class LoginDto {
  @ApiProperty({ example: 'elisabeth.perez@iudigital.edu.co' })
  @IsEmail({}, { message: 'Ingresa un email válido' })
  email: string;

  @ApiProperty({ example: 'MiContraseña123' })
  @IsString()
  @MinLength(8)
  password: string;
}

// DTO para el body del POST /auth/register
// Se define en register.dto.ts (NO hereda de CreateUserDto por seguridad:
// el registro público no puede elegir rol/nodo).
export { RegisterDto } from './register.dto';
