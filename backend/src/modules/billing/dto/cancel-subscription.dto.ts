import { IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  at_period_end?: boolean;
}
