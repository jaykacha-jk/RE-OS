import { Injectable, NotFoundException } from '@nestjs/common';

import { AI_FEATURES } from '../ai.constants';
import { AiRepository } from '../ai.repository';
import { MatchDto } from '../dto/match.dto';
import { matchProperties, type MatchCriteria, type PropertyMatch } from '../engines/matching.engine';
import { extractRequirements } from '../engines/qualification.engine';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';

export interface MatchResponse {
  criteria: MatchCriteria;
  matches: Array<{
    property_id: string;
    title: string;
    property_code: string;
    slug: string;
    city: string | null;
    price: number | null;
    bedrooms: number | null;
    match_score: number;
    reasons: string[];
  }>;
}

@Injectable()
export class PropertyMatchingService {
  constructor(
    private readonly repo: AiRepository,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  async match(tenantId: string, dto: MatchDto): Promise<MatchResponse> {
    const criteria = await this.resolveCriteria(tenantId, dto);
    const candidates = await this.repo.findMatchableProperties(tenantId, {
      city: criteria.city,
      propertyType: criteria.property_type,
      requirementType: criteria.requirement_type,
    });

    // If a strict city/type filter returned nothing, retry unfiltered so the
    // matcher can still rank by budget/bedrooms (avoids empty results).
    const pool = candidates.length
      ? candidates
      : await this.repo.findMatchableProperties(tenantId, {});

    const matches: PropertyMatch[] = matchProperties(pool, criteria, dto.limit ?? 5);

    const resolved = await this.settings.resolve(tenantId);
    await this.usage.record({
      tenantId,
      feature: AI_FEATURES.MATCHING,
      provider: resolved.provider,
      entityType: dto.inquiry_id ? 'inquiry' : null,
      entityId: dto.inquiry_id ?? null,
      metadata: { candidates: pool.length, returned: matches.length },
    });

    return {
      criteria,
      matches: matches.map((m) => ({
        property_id: m.property.id,
        title: m.property.title,
        property_code: m.property.property_code,
        slug: m.property.slug,
        city: m.property.city,
        price: m.property.price,
        bedrooms: m.property.bedrooms,
        match_score: m.score,
        reasons: m.reasons,
      })),
    };
  }

  private async resolveCriteria(tenantId: string, dto: MatchDto): Promise<MatchCriteria> {
    if (dto.inquiry_id) {
      const inquiry = await this.repo.findInquiryBasic(tenantId, dto.inquiry_id);
      if (!inquiry) throw new NotFoundException('Inquiry not found');
      return {
        budget_min: inquiry.budget_min != null ? Number(inquiry.budget_min) : null,
        budget_max: inquiry.budget_max != null ? Number(inquiry.budget_max) : null,
        city: inquiry.preferred_location ?? null,
        property_type: inquiry.property_type ?? null,
        requirement_type: inquiry.requirement_type ?? null,
        bedrooms: inquiry.bedrooms ?? null,
      };
    }

    // Free-text criteria are enriched by the extraction engine, then overridden
    // by any explicit fields the caller supplied.
    const fromText = dto.text ? extractRequirements(dto.text) : null;
    return {
      budget_min: dto.budget_min ?? fromText?.budget_min ?? null,
      budget_max: dto.budget_max ?? fromText?.budget_max ?? null,
      city: dto.city ?? fromText?.city ?? null,
      area: dto.area ?? fromText?.area ?? null,
      property_type: dto.property_type ?? fromText?.property_type ?? null,
      requirement_type: dto.requirement_type ?? fromText?.requirement_type ?? null,
      bedrooms: dto.bedrooms ?? fromText?.bedrooms ?? null,
      amenities: dto.amenities ?? [],
    };
  }
}
