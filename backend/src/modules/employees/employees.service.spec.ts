import { EmployeesService } from './employees.service';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { validate } from 'class-validator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

describe('EmployeesService invitations', () => {
  const originalEnv = process.env;

  const buildService = () => {
    const employeesRepository = {
      findOrganizationWithUsage: jest.fn(),
      findPlanMaxEmployees: jest.fn(),
      findUserByEmail: jest.fn(),
      findUserByPhone: jest.fn(),
      findRoleByCode: jest.fn(),
      createEmployee: jest.fn(),
      findEmployeeById: jest.fn(),
    };
    const auditService = { record: jest.fn() };
    const events = { emit: jest.fn() };
    const service = new EmployeesService(
      employeesRepository as never,
      auditService as never,
      events as never,
    );
    return { service, employeesRepository, auditService, events };
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      APP_URL: 'https://app.example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns a copyable invite link and queues the invitation event', async () => {
    const { service, employeesRepository, events } = buildService();
    employeesRepository.findOrganizationWithUsage.mockResolvedValue({
      id: 'tenant_1',
      name: 'Acme Realty',
      tier: 'starter',
      organization_usage: { employees_count: 1 },
    });
    employeesRepository.findPlanMaxEmployees.mockResolvedValue({ max_employees: 5 });
    employeesRepository.findUserByEmail.mockResolvedValue(null);
    employeesRepository.findRoleByCode.mockResolvedValue({
      id: 'role_sales',
      code: 'sales_executive',
    });
    employeesRepository.createEmployee.mockResolvedValue({
      employee: { id: 'employee_1' },
    });
    employeesRepository.findEmployeeById.mockResolvedValue({
      id: 'employee_1',
      status: 'active',
      manager_id: null,
      joined_at: new Date('2026-06-12T14:00:00.000Z'),
      user: {
        id: 'user_1',
        email: 'sales@acme.in',
        phone: '+919876543210',
        first_name: 'Ravi',
        last_name: 'Shah',
        status: 'invited',
        user_roles: [{ role: { code: 'sales_executive', name: 'Sales Executive' } }],
      },
      manager: null,
    });

    const result = await service.createEmployee(
      'tenant_1',
      {
        first_name: 'Ravi',
        last_name: 'Shah',
        email: 'sales@acme.in',
        phone: '+919876543210',
        role_code: 'sales_executive',
      },
      {
        userId: 'owner_1',
        tenantId: 'tenant_1',
        roles: ['org_owner'],
        permissions: ['employees.create'],
      },
    );

    expect(result.invitation_sent).toBe(true);
    expect(result.invitation_email_status).toBe('queued');
    expect(result.accept_url).toMatch(
      /^https:\/\/app\.example\.com\/accept-invitation\?token=/,
    );
    expect(result).not.toHaveProperty('invitation_token');
    expect(events.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.USER_INVITED,
      expect.objectContaining({
        tenantId: 'tenant_1',
        recipientUserIds: ['user_1'],
        context: expect.objectContaining({
          organizationName: 'Acme Realty',
          acceptUrl: result.accept_url,
        }),
      }),
    );
  });
});

describe('Employees DTO role validation', () => {
  it('rejects the unseeded marketing_user role on create', async () => {
    const dto = Object.assign(new CreateEmployeeDto(), {
      first_name: 'Mira',
      last_name: 'Shah',
      email: 'mira@example.com',
      role_code: 'marketing_user',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'role_code')).toBe(true);
  });

  it('rejects the unseeded marketing_user role on update', async () => {
    const dto = Object.assign(new UpdateEmployeeDto(), {
      role_code: 'marketing_user',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'role_code')).toBe(true);
  });
});
