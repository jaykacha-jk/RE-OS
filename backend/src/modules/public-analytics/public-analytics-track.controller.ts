import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { TrackEventDto } from './dto/track-event.dto';
import { PublicAnalyticsService } from './public-analytics.service';

/**
 * Public, unauthenticated analytics ingestion endpoint used by the tenant's
 * website (property views/clicks, page views, conversions). Tenant is resolved
 * from the `tenant` slug in the body; raw IPs are never stored (hashed only).
 */
@ApiTags('Public Analytics')
@Controller('api/v1/public/analytics')
export class PublicAnalyticsTrackController {
  constructor(private readonly analytics: PublicAnalyticsService) {}

  @Post('track')
  @HttpCode(202)
  @ApiOperation({ summary: 'Track a public website event' })
  @ApiOkResponse({ description: 'Event accepted' })
  async track(@Body() dto: TrackEventDto, @Req() req: Request) {
    const result = await this.analytics.track(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    return { data: result, meta: { request_id: randomBytes(16).toString('hex') } };
  }
}
