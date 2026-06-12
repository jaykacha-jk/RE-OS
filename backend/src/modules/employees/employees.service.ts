import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditService: AuditService,
    private readonly events: DomainEventBus,
  ) {}

  private mapEmployee(employee: {
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
  }) {
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
      properties_assigned_count: 0,
      open_inquiries_count: 0,
    };
  }

  private async assertCanCreateEmployee(tenantId: string) {
    const org = await this.employeesRepository.findOrganizationWithUsage(tenantId);
    if (!org) throw new NotFoundException('Organization not found');

    const plan = await this.employeesRepository.findPlanMaxEmployees(org.tier);
    const maxEmployees = plan?.max_employees ?? 10;
    const current = org.organization_usage?.employees_count ?? 0;

    if (current >= maxEmployees) {
      throw new UnprocessableEntityException({
        code: 'QUOTA_EXCEEDED',
        message: 'Employee quota exceeded for current plan',
        rule_id: 'BR-T04',
      });
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

    return {
      data: rows.map((row) => this.mapEmployee(row)),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async getEmployee(tenantId: string, employeeId: string) {
    const employee = await this.employeesRepository.findEmployeeById(tenantId, employeeId);
    if (!employee) throw new NotFoundException('Employee not found');
    return this.mapEmployee(employee);
  }

  async createEmployee(
    tenantId: string,
    dto: CreateEmployeeDto,
    actor?: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    await this.assertCanCreateEmployee(tenantId);

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
      invitation_sent: false,
      invitation_pending: true,
      ...this.devInvitationHint(invitationToken),
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

    // Phase 5: welcome/notify the invited user.
    this.events.emit(DOMAIN_EVENTS.USER_INVITED, {
      tenantId,
      actorUserId: actor?.userId ?? null,
      entityType: 'user',
      entityId: response.employee.user_id,
      recipientUserIds: [response.employee.user_id],
      context: { email: dto.email, roleCode: dto.role_code },
    });

    return response;
  }

  private devInvitationHint(token: string) {
    if (process.env.NODE_ENV === 'production') return {};
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return {
      invitation_token: token,
      accept_url: `${base}/accept-invitation?token=${encodeURIComponent(token)}`,
    };
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
