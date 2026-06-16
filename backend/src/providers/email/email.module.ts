import { Module } from '@nestjs/common';

import { DevEmailProvider } from './dev-email-provider';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ProductionEmailProvider } from './production-email-provider';

/**
 * Binds the `EMAIL_PROVIDER` token to a concrete implementation. Production
 * always selects the real provider so a deploy cannot silently use dev email.
 */
@Module({
  providers: [
    DevEmailProvider,
    ProductionEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (dev: DevEmailProvider, prod: ProductionEmailProvider) => {
        if (process.env.NODE_ENV === 'production' && process.env.EMAIL_PROVIDER !== 'production') {
          throw new Error('EMAIL_PROVIDER=production is required in production');
        }
        return process.env.EMAIL_PROVIDER === 'production' ? prod : dev;
      },
      inject: [DevEmailProvider, ProductionEmailProvider],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
