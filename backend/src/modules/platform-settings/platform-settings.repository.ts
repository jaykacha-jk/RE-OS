import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PlatformSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByKey(key: string) {
    return this.prisma.dbClient.platform_settings.findUnique({ where: { key } });
  }

  async upsertEncrypted(input: {
    key: string;
    valueEnc: string;
    version: number;
    previousValueEnc: string | null;
    updatedBy: string;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const row = await tx.platform_settings.upsert({
        where: { key: input.key },
        create: {
          key: input.key,
          value_enc: input.valueEnc,
          version: input.version,
          updated_by: input.updatedBy,
        },
        update: {
          value_enc: input.valueEnc,
          version: input.version,
          updated_by: input.updatedBy,
        },
      });

      if (input.previousValueEnc) {
        await tx.platform_settings_history.create({
          data: {
            settings_key: input.key,
            version: input.version - 1,
            value_enc: input.previousValueEnc,
            changed_by: input.updatedBy,
          },
        });
      }

      return row;
    });
  }
}
