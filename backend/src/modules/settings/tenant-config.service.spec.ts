import { SettingsService } from './settings.service';
import { TenantConfigService } from './tenant-config.service';
import { DEFAULT_CONFIGURATION } from './settings.constants';

function build(stored: Record<string, unknown> = {}) {
  const settings = {
    getCategory: jest.fn().mockResolvedValue({ ...DEFAULT_CONFIGURATION, ...stored }),
  } as unknown as SettingsService;
  return new TenantConfigService(settings);
}

describe('TenantConfigService', () => {
  it('returns Indian-market defaults', async () => {
    const service = build();
    const cfg = await service.getConfiguration('t1');
    expect(cfg.timezone).toBe('Asia/Kolkata');
    expect(cfg.currency).toBe('INR');
    expect(cfg.number_format).toBe('en-IN');
  });

  it('applies overrides', async () => {
    const service = build({ currency: 'AED', timezone: 'Asia/Dubai' });
    expect(await service.getCurrency('t1')).toBe('AED');
    expect(await service.getTimezone('t1')).toBe('Asia/Dubai');
  });
});
