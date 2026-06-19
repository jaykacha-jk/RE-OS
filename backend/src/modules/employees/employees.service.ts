import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesRepository } from './employees.repository';
import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { QuotaService } from '../billing/quota.service';

const INVITATION_TTL_DAYS = 7;
const ROLE_RANK: Record<string, number> = {
  telecaller: 1,
  sales_executive: 2,
  sales_manager: 3,
  org_admin: 4,
  org_owner: 5,
};
const EMPLOYEE_FULL_ACCESS_ROLES = ['super_admin', 'org_owner', 'org_admin'];

@Injectable()
export class EmployeesService {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditService: AuditService,
    private readonly events: DomainEventBus,
    private readonly quota: QuotaService,
  ) {}

  private mapEmployee(
    employee: {
      id: string;
      status: string;
      manager_id: string | null;
      joined_at: Date | null;
      user: {
        id: string;
        email: string;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        status: string;
        user_roles: { role: { code: string; name: string } }[];
      };
      manager?: {
        id: string;
        user: { first_name: string | null; last_name: string | null };
      } | null;
    },
    kpis?: { propertiesAssigned: number; openInquiries: number },
  ) {
    const role = employee.user.user_roles[0]?.role;
    return {
      id: employee.id,
      user_id: employee.user.id,
      email: employee.user.email,
      phone: employee.user.phone,
      first_name: employee.user.first_name,
      last_name: employee.user.last_name,
      status: employee.status,
      user_status: employee.user.status,
      role_code: role?.code ?? null,
      role_name: role?.name ?? null,
      manager_id: employee.manager_id,
      manager_name: employee.manager
        ? [employee.manager.user.first_name, employee.manager.user.last_name]
            .filter(Boolean)
            .join(' ')
        : null,
      joined_at: employee.joined_at?.toISOString() ?? null,
      properties_assigned_count: kpis?.propertiesAssigned ?? 0,
      open_inquiries_count: kpis?.openInquiries ?? 0,
    };
  }

  private async loadEmployeeKpis(tenantId: string, employeeIds: string[]) {
    const [propertyCounts, inquiryCounts] = await Promise.all([
      this.employeesRepository.countPropertyAssignmentsByEmployee(tenantId, employeeIds),
      this.employeesRepository.countOpenInquiriesByEmployee(tenantId, employeeIds),
    ]);
    return { propertyCounts, inquiryCounts };
  }

  private async assertCanViewEmployee(
    tenantId: string,
    actor: AuthUser,
    targetEmployeeId: string,
  ) {
    if (actor.roles.some((role) => EMPLOYEE_FULL_ACCESS_ROLES.includes(role))) return;

    const actorEmployee = await this.employeesRepository.findEmployeeByUserId(
      tenantId,
      actor.userId,
    );
    if (!actorEmployee) {
      throw new ForbiddenException('Insufficient access to view employee');
    }

    if (actor.roles.includes('sales_manager')) {
      const subordinateIds = await this.employeesRepository.findSubordinateEmployeeIds(
        actorEmployee.id,
      );
      const allowed = new Set([actorEmployee.id, ...subordinateIds]);
      if (!allowed.has(targetEmployeeId)) {
        throw new ForbiddenException('Insufficient access to view employee');
      }
      return;
    }

    if (targetEmployeeId !== actorEmployee.id) {
      throw new ForbiddenException('Insufficient access to view employee');
    }
  }

  private assertCanAssignRole(actor: AuthUser | undefined, targetRoleCode: string) {
    const targetRank = ROLE_RANK[targetRoleCode] ?? 0;
    if (!actor || targetRank === 0) {
      throw new ForbiddenException('Insufficient role hierarchy to assign employee role');
    }

    const actorRank = Math.max(...actor.roles.map((role) => ROLE_RANK[role] ?? 0), 0);
    if (actorRank <= targetRank) {
      throw new ForbiddenException('Insufficient role hierarchy to assign employee role');
    }
  }

  private roleCodeFor(employee: {
    user: { user_roles: { role: { code: string } }[] };
  }): string | null {
    return employee.user.user_roles[0]?.role.code ?? null;
  }

  private assertCanModifyEmployeeRole(actor: AuthUser | undefined, targetRoleCode: string | null) {
    const targetRank = targetRoleCode ? ROLE_RANK[targetRoleCode] ?? 0 : 0;
    if (!actor || targetRank === 0) {
      throw new ForbiddenException('Insufficient role hierarchy to modify employee role');
    }

    const actorRank = Math.max(...actor.roles.map((role) => ROLE_RANK[role] ?? 0), 0);
    if (actorRank <= targetRank) {
      throw new ForbiddenException('Insufficient role hierarchy to modify employee role');
    }
  }

  async listEmployees(tenantId: string, query: ListEmployeesQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const { rows, total } = await this.employeesRepository.listEmployees({
      tenantId,
      role: query['filter[role]'],
      status: query['filter[status]'],
      search: query['filter[search]'],
      page,
      perPage,
    });

    const employeeIds = rows.map((row) => row.id);
    const { propertyCounts, inquiryCounts } = await this.loadEmployeeKpis(tenantId, employeeIds);

    return {
      data: rows.map((row) =>
        this.mapEmployee(row, {
          propertiesAssigned: propertyCounts.get(row.id) ?? 0,
          openInquiries: inquiryCounts.get(row.id) ?? 0,
        }),
      ),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async getEmployee(tenantId: string, employeeId: string, actor?: AuthUser) {
    const employee = await this.employeesRepository.findEmployeeById(tenantId, employeeId);
    if (!employee) throw new NotFoundException('Employee not found');
    if (actor) await this.assertCanViewEmployee(tenantId, actor, employeeId);

    const { propertyCounts, inquiryCounts } = await this.loadEmployeeKpis(tenantId, [employeeId]);
    return this.mapEmployee(employee, {
      propertiesAssigned: propertyCounts.get(employeeId) ?? 0,
      openInquiries: inquiryCounts.get(employeeId) ?? 0,
    });
  }

  async createEmployee(
    tenantId: string,
    dto: CreateEmployeeDto,
    actor?: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    await this.quota.assertCanCreateEmployee(tenantId);
    const org = await this.employeesRepository.findOrganizationWithUsage(tenantId);
    if (!org) throw new NotFoundException('Organization not found');

    const existingEmail = await this.employeesRepository.findUserByEmail(tenantId, dto.email);
    if (existingEmail) {
      throw new ConflictException('Email already exists in this organization');
    }

    if (dto.phone) {
      const existingPhone = await this.employeesRepository.findUserByPhone(tenantId, dto.phone);
      if (existingPhone) {
        throw new ConflictException('Phone already exists in this organization');
      }
    }

    if (dto.manager_id) {
      const manager = await this.employeesRepository.findEmployeeById(tenantId, dto.manager_id);
      if (!manager) {
        throw new BadRequestException('manager_id is invalid for this tenant');
      }
    }

    const role = await this.employeesRepository.findRoleByCode(dto.role_code);
    if (!role) throw new NotFoundException('Role is not seeded');
    this.assertCanAssignRole(actor, dto.role_code);

    const invitationToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(invitationToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const created = await this.employeesRepository.createEmployee({
      tenantId,
      email: dto.email,
      phone: dto.phone,
      firstName: dto.first_name,
      lastName: dto.last_name,
      roleId: role.id,
      managerId: dto.manager_id,
      tokenHash,
      expiresAt,
    });

    const employee = await this.employeesRepository.findEmployeeById(
      tenantId,
      created.employee.id,
    );
    if (!employee) throw new NotFoundException('Employee not found after create');

    const response = {
      employee: this.mapEmployee(employee),
      invitation_sent: true,
      invitation_email_status: 'queued',
      invitation_pending: true,
      accept_url: this.invitationUrl(invitationToken),
      expires_at: expiresAt.toISOString(),
      ...this.devInvitationTokenHint(invitationToken),
    };

    await this.auditService.record({
      actor,
      tenantId,
      action: 'employees.created',
      entityType: 'employee',
      entityId: employee.id,
      afterState: response.employee,
      meta,
    });

    this.events.emit(DOMAIN_EVENTS.USER_INVITED, {
      tenantId,
      actorUserId: actor?.userId ?? null,
      entityType: 'user',
      entityId: response.employee.user_id,
      recipientUserIds: [response.employee.user_id],
      context: {
        email: dto.email,
        roleCode: dto.role_code,
        organizationName: org.name,
        acceptUrl: this.invitationUrl(invitationToken),
      },
    });

    return response;
  }

  private devInvitationTokenHint(token: string) {
    if (process.env.NODE_ENV === 'production') return {};
    return {
      invitation_token: token,
    };
  }

  private invitationUrl(token: string): string {
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/accept-invitation?token=${encodeURIComponent(token)}`;
  }

  async updateEmployee(
    tenantId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
    actor?: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.employeesRepository.findEmployeeById(tenantId, employeeId);
    if (!existing) throw new NotFoundException('Employee not found');
    this.assertCanModifyEmployeeRole(actor, this.roleCodeFor(existing));

    if (dto.manager_id) {
      const manager = await this.employeesRepository.findEmployeeById(tenantId, dto.manager_id);
      if (!manager) {
        throw new BadRequestException('manager_id is invalid for this tenant');
      }
      if (manager.id === employeeId) {
        throw new BadRequestException('Employee cannot be their own manager');
      }
    }

    let roleId: string | undefined;
    if (dto.role_code) {
      const role = await this.employeesRepository.findRoleByCode(dto.role_code);
      if (!role) throw new NotFoundException('Role is not seeded');
      this.assertCanAssignRole(actor, dto.role_code);
      roleId = role.id;
    }

    const updated = await this.employeesRepository.updateEmployee(tenantId, employeeId, {
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
      status: dto.status,
      managerId: dto.manager_id,
      roleId,
    });

    if (!updated) throw new NotFoundException('Employee not found');
    const mapped = this.mapEmployee(updated);
    await this.auditService.record({
      actor,
      tenantId,
      action: 'employees.updated',
      entityType: 'employee',
      entityId: employeeId,
      beforeState: this.mapEmployee(existing),
      afterState: mapped,
      meta,
    });

    return mapped;
  }

  async deleteEmployee(
    tenantId: string,
    employeeId: string,
    actor?: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.employeesRepository.findEmployeeById(tenantId, employeeId);
    if (!existing) throw new NotFoundException('Employee not found');
    this.assertCanModifyEmployeeRole(actor, this.roleCodeFor(existing));

    // BR-E02: inquiry reassignment enforced when inquiries module ships (Phase 3).
    const deleted = await this.employeesRepository.softDeleteEmployee(tenantId, employeeId);
    if (!deleted) throw new NotFoundException('Employee not found');

    await this.auditService.record({
      actor,
      tenantId,
      action: 'employees.deleted',
      entityType: 'employee',
      entityId: employeeId,
      beforeState: this.mapEmployee(existing),
      meta,
    });

    return { id: employeeId, deleted: true };
  }
}
