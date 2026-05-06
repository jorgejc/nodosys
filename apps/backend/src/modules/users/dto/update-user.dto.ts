/**
 * update-user.dto.ts
 *
 * PartialType convierte todos los campos de CreateUserDto en opcionales.
 * Así, en el PATCH /users/:id puedes enviar solo los campos que cambian.
 */
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// OmitType excluye el campo 'password' del update (tiene su propio endpoint)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}
