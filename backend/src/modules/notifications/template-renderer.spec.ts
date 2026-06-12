import { TemplateRenderer } from './template-renderer';
import { DOMAIN_EVENTS } from '../../events/domain-events';

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  describe('interpolate', () => {
    it('substitutes flat variables', () => {
      expect(renderer.interpolate('Hi {{name}}', { name: 'Asha' })).toBe('Hi Asha');
    });

    it('supports dotted paths', () => {
      expect(
        renderer.interpolate('{{property.title}}', { property: { title: 'Villa' } }),
      ).toBe('Villa');
    });

    it('renders unknown variables as empty string (never leaks raw tokens)', () => {
      expect(renderer.interpolate('Hi {{missing}}!', {})).toBe('Hi !');
    });

    it('tolerates whitespace inside braces', () => {
      expect(renderer.interpolate('{{  name  }}', { name: 'X' })).toBe('X');
    });
  });

  describe('render resolution order', () => {
    it('prefers a DB template over the system default', () => {
      const out = renderer.render({
        key: DOMAIN_EVENTS.LEAD_ASSIGNED,
        channel: 'in_app',
        context: { clientName: 'Ravi', inquiryCode: 'INQ-1' },
        dbTemplate: {
          title_template: 'Custom {{clientName}}',
          body_template: 'Body {{inquiryCode}}',
          email_subject_template: null,
          type: 'CRM',
          priority: 'LOW',
        },
      });
      expect(out.title).toBe('Custom Ravi');
      expect(out.body).toBe('Body INQ-1');
      // email subject falls back to title template when subject missing
      expect(out.emailSubject).toBe('Custom Ravi');
      expect(out.priority).toBe('LOW');
    });

    it('falls back to the system template when no DB template', () => {
      const out = renderer.render({
        key: DOMAIN_EVENTS.LEAD_ASSIGNED,
        channel: 'in_app',
        context: { clientName: 'Ravi', inquiryCode: 'INQ-1' },
      });
      expect(out.title).toContain('Ravi');
      expect(out.type).toBe('CRM');
      expect(out.priority).toBe('HIGH');
    });

    it('renders invitation emails with an accept link', () => {
      const out = renderer.render({
        key: DOMAIN_EVENTS.USER_INVITED,
        channel: 'email',
        context: {
          organizationName: 'Acme Realty',
          acceptUrl: 'https://app.example.com/accept-invitation?token=abc',
        },
      });

      expect(out.emailSubject).toBe('You are invited to Acme Realty');
      expect(out.body).toContain('Acme Realty');
      expect(out.body).toContain(
        'https://app.example.com/accept-invitation?token=abc',
      );
    });

    it('uses explicit fallback when key has no template', () => {
      const out = renderer.render({
        key: 'unknown.event',
        channel: 'in_app',
        context: {},
        fallback: { type: 'SYSTEM', priority: 'MEDIUM', title: 'T', body: 'B' },
      });
      expect(out.title).toBe('T');
      expect(out.body).toBe('B');
    });

    it('uses generic last-resort copy when nothing matches', () => {
      const out = renderer.render({ key: 'x', channel: 'in_app', context: {} });
      expect(out.title).toBe('Notification');
      expect(out.type).toBe('SYSTEM');
    });
  });
});
