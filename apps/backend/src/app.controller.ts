import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /api/health → para saber si el servidor está vivo
  @Get('health')
  @ApiOperation({ summary: 'Verificar que el servidor está corriendo' })
  getHealth(): object {
    return this.appService.getHealth();
  }
}
