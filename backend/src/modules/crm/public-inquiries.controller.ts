import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CrmService } from './crm.service';
import { PublicInquiryDto } from './dto/public-inquiry.dto';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

@ApiTags('Public Website')
@Controller('api/v1/public/:tenantSlug/inquiries')
export class PublicInquiriesController {
  constructor(private readonly crm: CrmService) {}

  @Post()
  @ApiOperation({ summary: 'Create CRM inquiry from public website form' })
  @ApiCreatedResponse({ description: 'Public inquiry created' })
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: PublicInquiryDto,
    @Req() req: Request,
  ) {
    const data = await this.crm.createPublicInquiry(tenantSlug, dto, requestMeta(req));
    return { data, meta: { request_id: randomBytes(16).toString('hex') } };
  }
}
