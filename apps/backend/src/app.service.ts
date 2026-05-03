import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      system: 'NodoSys',
      nodo: 'Arboletes',
      timestamp: new Date().toISOString(),
    };
  }
}
