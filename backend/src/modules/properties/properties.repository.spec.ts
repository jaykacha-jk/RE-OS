import { PropertiesRepository } from './properties.repository';

describe('PropertiesRepository tenant isolation', () => {
  function setup(txOverrides: Record<string, unknown> = {}) {
    const tx = {
      properties: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      property_amenities: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      property_tags: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      property_history: { create: jest.fn().mockResolvedValue({}) },
      property_images: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sort_order: 0 } }),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'img-1' }),
      },
      ...txOverrides,
    };
    const db = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      property_images: { count: jest.fn() },
    };
    const repo = new PropertiesRepository({ dbClient: db } as never);
    return { repo, db, tx };
  }

  it('builds list predicates with tenant and deleted filters', () => {
    const { repo } = setup();

    expect(repo.buildWhere('tenant-1', {}, { type: 'all' })).toEqual({
      tenant_id: 'tenant-1',
      deleted_at: null,
    });
  });

  it('rejects list predicates that are missing tenant scope', async () => {
    const { repo } = setup();

    await expect(
      repo.list({
        where: { deleted_at: null },
        sortBy: 'created_at',
        sortDir: 'desc',
        page: 1,
        perPage: 10,
      }),
    ).rejects.toThrow('PropertiesRepository.list must include tenant_id');
  });

  it('scopes property updates and child replacements by tenant', async () => {
    const { repo, tx } = setup();

    await repo.updateProperty({
      tenantId: 'tenant-1',
      id: 'property-1',
      data: { title: 'Updated' },
      amenities: ['Pool'],
      tags: ['premium'],
      historyEntries: [
        {
          change_type: 'updated',
          changed_fields: { title: 'Updated' },
        },
      ],
    });

    expect(tx.properties.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-1', tenant_id: 'tenant-1', deleted_at: null },
      }),
    );
    expect(tx.property_amenities.deleteMany).toHaveBeenCalledWith({
      where: { property_id: 'property-1', tenant_id: 'tenant-1' },
    });
    expect(tx.property_tags.deleteMany).toHaveBeenCalledWith({
      where: { property_id: 'property-1', tenant_id: 'tenant-1' },
    });
    expect(tx.property_history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          property_id: 'property-1',
        }),
      }),
    );
  });

  it('scopes image aggregate/count and cover reset by tenant', async () => {
    const { repo, tx } = setup();

    await repo.addImage({
      tenantId: 'tenant-1',
      propertyId: 'property-1',
      url: 'https://cdn.example/image.jpg',
      isCover: true,
    });

    expect(tx.property_images.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { property_id: 'property-1', tenant_id: 'tenant-1' },
      }),
    );
    expect(tx.property_images.count).toHaveBeenCalledWith({
      where: { property_id: 'property-1', tenant_id: 'tenant-1' },
    });
    expect(tx.property_images.updateMany).toHaveBeenCalledWith({
      where: { property_id: 'property-1', tenant_id: 'tenant-1' },
      data: { is_cover: false },
    });
  });
});
