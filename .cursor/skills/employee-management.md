# Employee Management — Agent Skill

## Domain Knowledge

Employees link internal users to tenant workforce. Each employee has one user account, role(s), optional manager hierarchy, and performance-related counts (assignments, inquiries).

**Roles map to RBAC:** org_admin, sales_manager, sales_executive, telecaller, marketing_user

## Business Workflow

1. Org Admin creates employee with name, email, phone, role
2. System creates user (status=invited) + employee row + sends invitation
3. Employee accepts invite, sets password, lands on role-filtered dashboard
4. Manager assigns as `manager_id` for hierarchy
5. Deactivate: soft delete; must reassign open inquiries first BR-E02

## Entity Relationships

```
users 1──1 employees (per tenant)
employees *──1 employees (manager_id self-FK)
employees 1──* property_assignments
employees 1──* inquiries (assigned_employee_id)
user_roles links users to roles
```

## Validation Rules

- BR-E01: one user per employee per tenant
- BR-E02: cannot delete with open inquiries without reassignment
- BR-E03: no manager cycles
- BR-E04: at least one org_owner or org_admin active
- Phone E.164; email unique per tenant

## Common Edge Cases

- Inviting existing active user email in same tenant → 409
- Demoting last org_admin → 422 BR-E04
- Employee with role change mid-session → permissions refresh on next token
- Telecaller attempting employee delete → 403

## API Considerations

- `GET /employees` includes aggregated counts (properties, inquiries)
- Sales executive cannot list all employees unless permission granted
- Invitation resend endpoint rate limited

## Database Considerations

- Standard tenant audit columns on `employees`
- Index `(tenant_id, status)`, `(tenant_id, user_id)` unique
- On soft delete user: also soft delete employee row
