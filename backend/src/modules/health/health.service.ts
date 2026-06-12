import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  async health() {
    // Phase 1: basic liveness/readiness shell.
    return { status: 'ok' };
  }
}

