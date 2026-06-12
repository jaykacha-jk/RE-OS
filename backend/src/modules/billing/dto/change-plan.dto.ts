import { IsIn } from 'class-validator';

import { BILLING_CYCLES, BILLING_PLAN_CODES, type BillingCycle, type BillingPlanCode } from '../billing.constants';

export class ChangePlanDto {
  @IsIn(BILLING_PLAN_CODES)
  plan_code!: BillingPlanCode;

  @IsIn(BILLING_CYCLES)
  billing_cycle!: BillingCycle;
}
