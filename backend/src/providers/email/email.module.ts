import { Module } from '@nestjs/common';

import { DevEmailProvider } from './dev-email-provider';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ProductionEmailProvider } from './production-email-provider';

/**
 * Binds the `EMAIL_PROVIDER` token to a concrete implementation based on the
 * EMAIL_PROVIDER env var. Defaults to the dev provider so the pipeline works
 * out-of-the-box locally. Consumers depend only on the `EmailProvider`
 * interface (provider-agnostic).
 */
@Module({
  providers: [
    DevEmailProvider,
    ProductionEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (dev: DevEmailProvider, prod: ProductionEmailProvider) =>
        process.env.EMAIL_PROVIDER === 'production' ? prod : dev,
      inject: [DevEmailProvider, ProductionEmailProvider],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
