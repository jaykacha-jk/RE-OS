import type { IconName } from '../ui/icons';
import { isSuperAdmin, type AuthSession } from '../../lib/auth';

export type NavGroup = 'Command' | 'Sales' | 'AI' | 'Operations' | 'Platform';

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  roles: 'all' | 'tenant' | 'audit' | 'super_admin' | 'permission' | 'performance';
  permission?: string;
  group: NavGroup;
};

export const PERFORMANCE_ROLES = ['org_owner', 'org_admin', 'marketing_user', 'sales_manager'];

export const NAV_GROUPS: NavGroup[] = ['Command', 'Sales', 'AI', 'Operations', 'Platform'];

export const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: 'all', group: 'Command' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics', roles: 'permission', permission: 'analytics.read', group: 'Command' },
  { href: '/performance', label: 'Performance', icon: 'performance', roles: 'performance', group: 'Command' },
  { href: '/properties', label: 'Properties', icon: 'properties', roles: 'permission', permission: 'properties.read', group: 'Sales' },
  { href: '/inquiries', label: 'Inquiries', icon: 'inquiries', roles: 'permission', permission: 'crm.inquiries.read', group: 'Sales' },
  { href: '/pipeline', label: 'Pipeline', icon: 'pipeline', roles: 'permission', permission: 'crm.inquiries.read', group: 'Sales' },
  { href: '/chat', label: 'Chat', icon: 'chat', roles: 'permission', permission: 'chat.conversations.read', group: 'Sales' },
  { href: '/lead-sources', label: 'Lead sources', icon: 'leadSources', roles: 'permission', permission: 'crm.lead_sources.read', group: 'Sales' },
  { href: '/ai', label: 'AI dashboard', icon: 'ai', roles: 'permission', permission: 'ai.dashboard.read', group: 'AI' },
  { href: '/ai/playground', label: 'AI assistant', icon: 'playground', roles: 'permission', permission: 'ai.qualify', group: 'AI' },
  { href: '/ai/calls', label: 'Call logs', icon: 'calls', roles: 'permission', permission: 'ai.calls.read', group: 'AI' },
  { href: '/ai/followups', label: 'Follow-ups', icon: 'followups', roles: 'permission', permission: 'ai.followups.read', group: 'AI' },
  { href: '/ai/knowledge', label: 'Knowledge base', icon: 'knowledge', roles: 'permission', permission: 'ai.knowledge.read', group: 'AI' },
  { href: '/ai/prompts', label: 'Prompt templates', icon: 'prompts', roles: 'permission', permission: 'ai.prompts.manage', group: 'AI' },
  { href: '/ai/settings', label: 'AI settings', icon: 'settings', roles: 'permission', permission: 'ai.settings.read', group: 'AI' },
  { href: '/employees', label: 'Employees', icon: 'employees', roles: 'tenant', group: 'Operations' },
  { href: '/notifications', label: 'Notifications', icon: 'notifications', roles: 'permission', permission: 'notifications.read', group: 'Operations' },
  { href: '/billing', label: 'Billing', icon: 'billing', roles: 'permission', permission: 'billing.subscription.read', group: 'Platform' },
  { href: '/settings', label: 'Settings', icon: 'settings', roles: 'permission', permission: 'settings.read', group: 'Platform' },
  { href: '/settings/profile', label: 'Profile', icon: 'profile', roles: 'all', group: 'Platform' },
  { href: '/settings/notifications', label: 'Alert settings', icon: 'notifications', roles: 'permission', permission: 'notifications.read', group: 'Platform' },
  { href: '/audit-logs', label: 'Audit logs', icon: 'audit', roles: 'audit', group: 'Platform' },
  { href: '/platform/organizations', label: 'Organizations', icon: 'organizations', roles: 'super_admin', group: 'Platform' },
];

const tenantOnlyPrefixes = [
  '/analytics',
  '/performance',
  '/properties',
  '/inquiries',
  '/pipeline',
  '/chat',
  '/lead-sources',
  '/ai',
  '/employees',
  '/billing',
  '/settings/branding',
  '/settings/configuration',
  '/settings/domains',
  '/settings/features',
  '/settings/public-analytics',
  '/settings/seo',
  '/settings/website',
  '/settings/white-label',
  '/settings',
];

const platformSafePrefixes = ['/settings/profile', '/settings/notifications'];

export function isTenantOnlyPath(pathname: string): boolean {
  if (platformSafePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  return tenantOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Filter nav items by the session's roles + permissions. */
export function visibleNavFor(session: AuthSession): NavItem[] {
  const superAdmin = isSuperAdmin(session);
  return navItems.filter((item) => {
    if (item.roles === 'all') return true;
    if (item.roles === 'super_admin') return superAdmin;
    if (item.roles === 'performance') {
      return !superAdmin && session.user.roles.some((r) => PERFORMANCE_ROLES.includes(r));
    }
    if (item.roles === 'audit') return session.user.permissions.includes('audit.logs.read');
    if (item.roles === 'permission') {
      return !superAdmin && !!session.user.tenant_id && !!item.permission && session.user.permissions.includes(item.permission);
    }
    return !superAdmin && !!session.user.tenant_id;
  });
}
