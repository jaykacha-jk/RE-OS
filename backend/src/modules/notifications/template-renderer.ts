import { Injectable } from '@nestjs/common';

import {
  SYSTEM_TEMPLATES,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationType,
} from './notifications.constants';

export interface RenderedNotification {
  title: string;
  body: string;
  emailSubject: string;
  type: NotificationType;
  priority: NotificationPriority;
}

export interface TemplateInput {
  key: string;
  channel: NotificationChannel;
  context: Record<string, unknown>;
  /** Optional DB template overriding the system default. */
  dbTemplate?: {
    title_template: string;
    body_template: string;
    email_subject_template: string | null;
    type: string;
    priority: string;
  } | null;
  /** Fallbacks when neither DB nor system template exists. */
  fallback?: {
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    body: string;
  };
}

/**
 * Renders notification copy from templates.
 *
 * Resolution order: DB template (tenant override) -> system default template
 * -> explicit fallback. Variables use {{var}} and are substituted from the
 * provided context. Unknown variables render as an empty string (never leak
 * raw {{tokens}} to users).
 */
@Injectable()
export class TemplateRenderer {
  render(input: TemplateInput): RenderedNotification {
    const ctx = input.context ?? {};

    const db = input.dbTemplate;
    if (db) {
      return {
        title: this.interpolate(db.title_template, ctx),
        body: this.interpolate(db.body_template, ctx),
        emailSubject: this.interpolate(
          db.email_subject_template || db.title_template,
          ctx,
        ),
        type: db.type as NotificationType,
        priority: db.priority as NotificationPriority,
      };
    }

    const system = SYSTEM_TEMPLATES[input.key as keyof typeof SYSTEM_TEMPLATES];
    if (system) {
      return {
        title: this.interpolate(system.title, ctx),
        body: this.interpolate(system.body, ctx),
        emailSubject: this.interpolate(system.emailSubject, ctx),
        type: system.type,
        priority: system.priority,
      };
    }

    const fb = input.fallback;
    if (fb) {
      return {
        title: this.interpolate(fb.title, ctx),
        body: this.interpolate(fb.body, ctx),
        emailSubject: this.interpolate(fb.title, ctx),
        type: fb.type,
        priority: fb.priority,
      };
    }

    // Last-resort generic copy.
    return {
      title: this.interpolate('{{title}}', ctx) || 'Notification',
      body: this.interpolate('{{message}}', ctx) || '',
      emailSubject: 'Notification',
      type: 'SYSTEM',
      priority: 'MEDIUM',
    };
  }

  /** Public for unit testing the substitution logic. */
  interpolate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, rawKey: string) => {
      const value = this.lookup(context, rawKey);
      if (value === undefined || value === null) return '';
      return String(value);
    });
  }

  private lookup(context: Record<string, unknown>, path: string): unknown {
    if (path in context) return context[path];
    // Support dotted paths (e.g. property.title).
    return path.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, context);
  }
}
