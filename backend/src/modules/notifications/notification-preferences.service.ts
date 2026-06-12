import { Injectable } from '@nestjs/common';

import { NotificationsRepository } from './notifications.repository';
import {
  AUTOMATION_RULES,
  type DomainEventKey,
} from './notifications.constants';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
}

export interface PreferenceItem {
  event_key: string;
  label: string;
  type: string;
  in_app: boolean;
  email: boolean;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly repo: NotificationsRepository) {}

  /**
   * Resolve effective channel preferences for a user + event.
   * Default is ON for both channels when the user hasn't customised it.
   */
  async resolve(userId: string, eventKey: string): Promise<ChannelPreference> {
    const pref = await this.repo.findPreference(userId, eventKey);
    if (!pref) return { inApp: true, email: true };
    return { inApp: pref.in_app, email: pref.email };
  }

  /**
   * Full preference matrix for the settings UI: every automation rule with the
   * user's current choice (defaulting to ON) merged in.
   */
  async list(userId: string): Promise<PreferenceItem[]> {
    const stored = await this.repo.listPreferences(userId);
    const storedMap = new Map(stored.map((p) => [p.event_key, p]));

    return (Object.keys(AUTOMATION_RULES) as DomainEventKey[]).map((key) => {
      const rule = AUTOMATION_RULES[key];
      const pref = storedMap.get(key);
      return {
        event_key: key,
        label: rule.label,
        type: rule.type,
        in_app: pref ? pref.in_app : true,
        email: pref ? pref.email : true,
      };
    });
  }

  async update(
    userId: string,
    tenantId: string | null,
    dto: UpdatePreferencesDto,
  ): Promise<PreferenceItem[]> {
    for (const item of dto.preferences) {
      await this.repo.upsertPreference({
        userId,
        tenantId,
        eventKey: item.event_key,
        inApp: item.in_app,
        email: item.email,
      });
    }
    return this.list(userId);
  }
}
