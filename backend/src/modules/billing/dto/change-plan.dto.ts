import { IsIn, IsString, Matches } from 'class-validator';

import { BILLING_CYCLES, type BillingCycle } from '../billing.constants';

export class ChangePlanDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,48}$/)
  plan_code!: string;

  @IsIn(BILLING_CYCLES)
  billing_cycle!: BillingCycle;
}
