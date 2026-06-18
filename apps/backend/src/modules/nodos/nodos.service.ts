import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nodo } from './entities/nodo.entity';

@Injectable()
export class NodosService {
  constructor(
    @InjectRepository(Nodo)
    private readonly repo: Repository<Nodo>,
  ) {}

  async findAll(): Promise<{ nodoId: string; nodoName: string }[]> {
    const nodos = await this.repo.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    return nodos.map(n => ({ nodoId: n.id, nodoName: n.name }));
  }
}
