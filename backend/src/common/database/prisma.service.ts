import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { createPrismaClient } from './create-prisma-client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private clientInstance: PrismaClient | null = null;

  private get db(): PrismaClient {
    if (this.clientInstance) return this.clientInstance;
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }
    this.clientInstance = createPrismaClient();
    return this.clientInstance;
  }

  get dbClient() {
    return this.db;
  }

  async onModuleDestroy() {
    if (!this.clientInstance) return;
    try {
      await this.clientInstance.$disconnect();
    } catch {
      // Ignore disconnect failures during shutdown.
    }
  }
}
