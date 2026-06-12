import { FeatureFlagsService } from './feature-flags.service';
import { SettingsService } from './settings.service';
import { DEFAULT_FEATURES } from './settings.constants';

function build(stored: Record<string, unknown> = {}) {
  const settings = {
    getCategory: jest.fn().mockResolvedValue({ ...DEFAULT_FEATURES, ...stored }),
  } as unknown as SettingsService;
  return { service: new FeatureFlagsService(settings), settings };
}

describe('FeatureFlagsService', () => {
  it('returns platform defaults when nothing overridden', async () => {
    const { service } = build();
    const flags = await service.getFlags('t1');
    expect(flags).toEqual(DEFAULT_FEATURES);
    expect(flags.ai).toBe(false);
    expect(flags.chat).toBe(true);
  });

  it('honours stored overrides and coerces unknown values to defaults', async () => {
    const { service } = build({ ai: true, chat: 'yes' });
    const flags = await service.getFlags('t1');
    expect(flags.ai).toBe(true);
    // Non-boolean stored value falls back to default (chat default = true).
    expect(flags.chat).toBe(true);
  });

  it('isEnabled reflects the resolved flag', async () => {
    const { service } = build({ billing: false });
    expect(await service.isEnabled('t1', 'billing')).toBe(false);
    expect(await service.isEnabled('t1', 'crm')).toBe(true);
    expect(await service.isEnabled('t1', 'nonexistent')).toBe(false);
  });
});
