import { EmployeesRepository } from './employees.repository';

describe('EmployeesRepository tenant isolation', () => {
  function setup(txOverrides: Record<string, unknown> = {}) {
    const employee = { id: 'employee-1', user_id: 'user-1' };
    const tx = {
      employees: {
        findFirst: jest.fn().mockResolvedValue(employee),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      users: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user_roles: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      organization_usage: { update: jest.fn().mockResolvedValue({}) },
      ...txOverrides,
    };
    const db = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      employees: { findFirst: jest.fn().mockResolvedValue(employee) },
      subscription_plans: { findUnique: jest.fn().mockResolvedValue({ max_employees: 25 }) },
    };
    const repo = new EmployeesRepository({ dbClient: db } as never);
    return { repo, db, tx };
  }

  it('maps the pro tier to the seeded pro subscription plan', async () => {
    const { repo, db } = setup();

    await repo.findPlanMaxEmployees('pro');

    expect(db.subscription_plans.findUnique).toHaveBeenCalledWith({
      where: { code: 'pro' },
      select: { max_employees: true },
    });
  });

  it('scopes employee updates and role replacement by tenant', async () => {
    const { repo, tx } = setup();

    await repo.updateEmployee('tenant-1', 'employee-1', {
      firstName: 'Asha',
      status: 'active',
      roleId: 'role-1',
    });

    expect(tx.employees.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'employee-1',
          deleted_at: null,
          user: { tenant_id: 'tenant-1', deleted_at: null },
        },
      }),
    );
    expect(tx.users.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1', tenant_id: 'tenant-1', deleted_at: null },
      }),
    );
    expect(tx.employees.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-1', user: { tenant_id: 'tenant-1', deleted_at: null } },
      }),
    );
    expect(tx.user_roles.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', tenant_id: 'tenant-1' },
    });
    expect(tx.user_roles.create).toHaveBeenCalledWith({
      data: { user_id: 'user-1', role_id: 'role-1', tenant_id: 'tenant-1' },
    });
  });

  it('scopes employee soft deletes by tenant', async () => {
    const { repo, tx } = setup();

    await repo.softDeleteEmployee('tenant-1', 'employee-1');

    expect(tx.employees.updateMany).toHaveBeenCalledWith({
      where: { id: 'employee-1', user: { tenant_id: 'tenant-1', deleted_at: null } },
      data: expect.objectContaining({ deleted_at: expect.any(Date), status: 'inactive' }),
    });
    expect(tx.users.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', tenant_id: 'tenant-1', deleted_at: null },
      data: expect.objectContaining({ deleted_at: expect.any(Date), status: 'suspended' }),
    });
    expect(tx.organization_usage.update).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-1' },
      data: { employees_count: { decrement: 1 } },
    });
  });
});
