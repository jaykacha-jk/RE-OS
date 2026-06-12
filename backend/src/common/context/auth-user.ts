export interface AuthUser {
  userId: string;
  tenantId: string | null; // null for platform-level super admin
  roles: string[];
  permissions: string[];
}

