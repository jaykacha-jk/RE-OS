import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';

import { PublicPropertiesQueryDto } from './dto/public-properties-query.dto';
import { PropertiesService } from './properties.service';

/**
 * Public, unauthenticated property listing foundation.
 * Tenant is resolved from the `tenant` slug query param (subdomain routing can
 * be layered on later). Only public-safe fields are returned — never tenant_id,
 * internal notes, audit fields, or assignment data.
 */
@ApiTags('Public Properties')
@Controller('api/v1/public/properties')
export class PublicPropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Public property listing (published + public + has image)' })
  @ApiOkResponse({ description: 'Paginated public listing' })
  async list(@Query() query: PublicPropertiesQueryDto) {
    const result = await this.properties.listPublic({
      tenant: query.tenant,
      search: query.search,
      type: query['filter[type]'] ?? query.filter?.type,
      category: query['filter[category]'] ?? query.filter?.category,
      requirementType: query['filter[requirement_type]'] ?? query.filter?.requirement_type,
      city: query['filter[city]'] ?? query.filter?.city,
      minPrice: query['filter[min_price]'] ?? query.filter?.min_price,
      maxPrice: query['filter[max_price]'] ?? query.filter?.max_price,
      page: query.page ?? 1,
      perPage: query.per_page ?? 24,
    });
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public property detail by slug (+ SEO meta)' })
  async getBySlug(@Param('slug') slug: string, @Query('tenant') tenant?: string) {
    const data = await this.properties.getPublicBySlug(slug, tenant);
    return { data, meta: { request_id: randomBytes(16).toString('hex') } };
  }
}
