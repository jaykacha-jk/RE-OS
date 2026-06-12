import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationWithUsage(tenantId: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { id: tenantId, deleted_at: null },
      include: { organization_usage: true },
    });
  }

  async findPlanMaxEmployees(tier: string) {
    const tierToPlan: Record<string, string> = {
      basic: 'starter',
      starter: 'starter',
      pro: 'growth',
      growth: 'growth',
      enterprise: 'enterprise',
    };
    const planCode = tierToPlan[tier] ?? 'starter';
    return this.prisma.dbClient.subscription_plans.findUnique({
      where: { code: planCode },
      select: { max_employees: true },
    });
  }

  async findRoleByCode(code: string) {
    return this.prisma.dbClient.roles.findFirst({
      where: { tenant_id: null, code, deleted_at: null },
    });
  }

  async findUserByEmail(tenantId: string, email: string) {
    return this.prisma.dbClient.users.findFirst({
      where: { tenant_id: tenantId, email, deleted_at: null },
    });
  }

  async findUserByPhone(tenantId: string, phone: string) {
    return this.prisma.dbClient.users.findFirst({
      where: { tenant_id: tenantId, phone, deleted_at: null },
    });
  }

  async findEmployeeById(tenantId: string, employeeId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: {
        id: employeeId,
        deleted_at: null,
        user: { tenant_id: tenantId, deleted_at: null },
      },
      include: {
        user: {
          include: {
            user_roles: {
              where: { tenant_id: tenantId },
              include: { role: true },
            },
          },
        },
        manager: {
          include: { user: true },
        },
      },
    });
  }

  async listEmployees(input: {
    tenantId: string;
    role?: string;
    status?: string;
    search?: string;
    page: number;
    perPage: number;
  }) {
    const search = input.search?.trim();
    const where = {
      deleted_at: null,
      ...(input.status ? { status: input.status } : {}),
      user: {
        tenant_id: input.tenantId,
        deleted_at: null,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' as const } },
                { first_name: { contains: search, mode: 'insensitive' as const } },
                { last_name: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(input.role
          ? {
              user_roles: {
                some: {
                  tenant_id: input.tenantId,
                  role: { code: input.role },
                },
              },
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.dbClient.employees.findMany({
        where,
        include: {
          user: {
            include: {
              user_roles: {
                where: { tenant_id: input.tenantId },
                include: { role: true },
              },
            },
          },
          manager: { include: { user: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.employees.count({ where }),
    ]);

    return { rows, total };
  }

  async createEmployee(input: {
    tenantId: string;
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    roleId: string;
    managerId?: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          tenant_id: input.tenantId,
          email: input.email,
          phone: input.phone,
          first_name: input.firstName,
          last_name: input.lastName,
          user_type: 'internal',
          status: 'invited',
        },
      });

      const employee = await tx.employees.create({
        data: {
          user_id: user.id,
          manager_id: input.managerId,
          status: 'active',
          joined_at: new Date(),
        },
      });

      await tx.user_roles.create({
        data: {
          user_id: user.id,
          role_id: input.roleId,
          tenant_id: input.tenantId,
        },
      });

      await tx.user_invitations.create({
        data: {
          email: input.email,
          role_id: input.roleId,
          token_hash: input.tokenHash,
          expires_at: input.expiresAt,
        },
      });

      await tx.organization_usage.update({
        where: { tenant_id: input.tenantId },
        data: { employees_count: { increment: 1 } },
      });

      return { user, employee };
    });
  }

  async updateEmployee(
    tenantId: string,
    employeeId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      status?: string;
      managerId?: string | null;
      roleId?: string;
    },
  ) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const employee = await tx.employees.findFirst({
        where: {
          id: employeeId,
          deleted_at: null,
          user: { tenant_id: tenantId, deleted_at: null },
        },
        include: { user: true },
      });
      if (!employee) return null;

      if (
        data.firstName !== undefined ||
        data.lastName !== undefined ||
        data.phone !== undefined ||
        data.status !== undefined
      ) {
        await tx.users.update({
          where: { id: employee.user_id },
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            phone: data.phone,
            ...(data.status ? { status: data.status } : {}),
          },
        });
      }

      if (data.managerId !== undefined || data.status !== undefined) {
        await tx.employees.update({
          where: { id: employeeId },
          data: {
            ...(data.managerId !== undefined ? { manager_id: data.managerId } : {}),
            ...(data.status ? { status: data.status } : {}),
          },
        });
      }

      if (data.roleId) {
        await tx.user_roles.deleteMany({
          where: { user_id: employee.user_id, tenant_id: tenantId },
        });
        await tx.user_roles.create({
          data: {
            user_id: employee.user_id,
            role_id: data.roleId,
            tenant_id: tenantId,
          },
        });
      }

      return this.findEmployeeById(tenantId, employeeId);
    });
  }

  async softDeleteEmployee(tenantId: string, employeeId: string) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const employee = await tx.employees.findFirst({
        where: {
          id: employeeId,
          deleted_at: null,
          user: { tenant_id: tenantId, deleted_at: null },
        },
      });
      if (!employee) return null;

      const now = new Date();
      await tx.employees.update({
        where: { id: employeeId },
        data: { deleted_at: now, status: 'inactive' },
      });
      await tx.users.update({
        where: { id: employee.user_id },
        data: { deleted_at: now, status: 'suspended' },
      });
      await tx.organization_usage.update({
        where: { tenant_id: tenantId },
        data: { employees_count: { decrement: 1 } },
      });

      return employee;
    });
  }
}
