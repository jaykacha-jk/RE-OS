import type { IconName } from '../ui/icons';
import { hasPermission, isFeatureEnabled, isImpersonating, isSuperAdmin, sessionWithEffectiveTenant, type AuthSession } from '../../lib/auth';

export type NavGroup =
  | 'Command'
  | 'Sales'
  | 'Team'
  | 'Communication'
  | 'Billing'
  | 'Settings'
  | 'Advanced'
  | 'Platform';

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  roles: 'all' | 'tenant' | 'audit' | 'super_admin' | 'permission' | 'performance';
  permission?: string;
  featureFlag?: string;
  group: NavGroup;
};

export const PERFORMANCE_ROLES = ['org_owner', 'org_admin', 'sales_manager'];
const ASSIGNED_SALES_ROLES = ['sales_executive', 'telecaller'];

const LAUNCH_HIDDEN_NAV_IDS = new Set([
  'settings.branding',
  'settings.seo',
  'settings.domains',
  'settings.configuration',
  'settings.website',
  'audit-logs',
  'ai.playground',
  'ai.calls',
  'ai.followups',
  'ai.knowledge',
  'ai.prompts',
  'ai.settings',
  'ai.dashboard',
  'settings.features',
  'settings.white-label',
]);

export const NAV_GROUPS: NavGroup[] = [
  'Command',
  'Sales',
  'Team',
  'Communication',
  'Billing',
  'Settings',
  'Advanced',
  'Platform',
];

type RouteMatcher = string | RegExp | ((pathname: string) => boolean);

export type RouteMetadata = {
  id: string;
  matcher: RouteMatcher;
  permission?: string;
  featureFlag?: string;
  roles?: string[];
  superAdminOnly?: boolean;
  tenantRequired?: boolean;
  nav?: {
    href: string;
    label: string;
    icon: IconName;
    group: NavGroup;
    roles?: NavItem['roles'];
  };
};

export const routeRegistry: RouteMetadata[] = [
  { id: 'dashboard', matcher: '/dashboard', nav: { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Command', roles: 'all' } },
  { id: 'analytics', matcher: '/analytics', permission: 'analytics.read', featureFlag: 'analytics', tenantRequired: true, nav: { href: '/analytics', label: 'Analytics', icon: 'analytics', group: 'Command' } },
  { id: 'performance', matcher: '/performance', roles: PERFORMANCE_ROLES, featureFlag: 'analytics', tenantRequired: true, nav: { href: '/performance', label: 'Performance', icon: 'performance', group: 'Command', roles: 'performance' } },
  { id: 'properties.create', matcher: '/properties/new', permission: 'properties.create', tenantRequired: true },
  { id: 'properties.update', matcher: /^\/properties\/[^/]+\/edit$/, permission: 'properties.update', tenantRequired: true },
  { id: 'properties.read', matcher: /^\/properties(\/.*)?$/, permission: 'properties.read', tenantRequired: true, nav: { href: '/properties', label: 'Properties', icon: 'properties', group: 'Sales' } },
  { id: 'inquiries.create', matcher: '/inquiries/new', permission: 'crm.inquiries.create', featureFlag: 'crm', tenantRequired: true },
  { id: 'inquiries.update', matcher: /^\/inquiries\/[^/]+\/edit$/, permission: 'crm.inquiries.update', featureFlag: 'crm', tenantRequired: true },
  { id: 'inquiries.read', matcher: /^\/inquiries(\/.*)?$/, permission: 'crm.inquiries.read', featureFlag: 'crm', tenantRequired: true, nav: { href: '/inquiries', label: 'Inquiries', icon: 'inquiries', group: 'Sales' } },
  { id: 'pipeline', matcher: '/pipeline', permission: 'crm.inquiries.read', featureFlag: 'crm', tenantRequired: true, nav: { href: '/pipeline', label: 'Pipeline', icon: 'pipeline', group: 'Sales' } },
  { id: 'lead-sources', matcher: '/lead-sources', permission: 'crm.lead_sources.read', featureFlag: 'crm', tenantRequired: true, nav: { href: '/lead-sources', label: 'Lead Sources', icon: 'leadSources', group: 'Sales' } },
  { id: 'employees', matcher: /^\/employees(\/.*)?$/, permission: 'employees.read', tenantRequired: true, nav: { href: '/employees', label: 'Employees', icon: 'employees', group: 'Team' } },
  { id: 'chat', matcher: '/chat', permission: 'chat.conversations.read', featureFlag: 'chat', tenantRequired: true, nav: { href: '/chat', label: 'Chat', icon: 'chat', group: 'Communication' } },
  { id: 'notifications', matcher: /^\/notifications(\/.*)?$/, permission: 'notifications.read', featureFlag: 'notifications', tenantRequired: true, nav: { href: '/notifications', label: 'Notifications', icon: 'notifications', group: 'Communication' } },
  { id: 'billing.overview', matcher: /^\/billing$/, permission: 'billing.subscription.read', featureFlag: 'billing', tenantRequired: true, nav: { href: '/billing', label: 'Billing', icon: 'billing', group: 'Billing' } },
  { id: 'billing.plans', matcher: '/billing/plans', permission: 'billing.plans.read', featureFlag: 'billing', tenantRequired: true, nav: { href: '/billing/plans', label: 'Plans', icon: 'billing', group: 'Billing' } },
  { id: 'billing.usage', matcher: '/billing/usage', permission: 'billing.usage.read', featureFlag: 'billing', tenantRequired: true, nav: { href: '/billing/usage', label: 'Usage', icon: 'performance', group: 'Billing' } },
  { id: 'billing.invoices', matcher: '/billing/invoices', permission: 'billing.invoices.read', featureFlag: 'billing', tenantRequired: true, nav: { href: '/billing/invoices', label: 'Invoices', icon: 'billing', group: 'Billing' } },
  { id: 'billing.subscription', matcher: /^\/billing(\/subscription)?$/, permission: 'billing.subscription.read', featureFlag: 'billing', tenantRequired: true },
  { id: 'settings.profile', matcher: '/settings/profile', nav: { href: '/settings/profile', label: 'Profile', icon: 'profile', group: 'Settings', roles: 'all' } },
  { id: 'settings.notifications', matcher: '/settings/notifications', permission: 'notifications.read', featureFlag: 'notifications', nav: { href: '/settings/notifications', label: 'Alert Settings', icon: 'notifications', group: 'Settings' } },
  { id: 'settings.branding', matcher: '/settings/branding', permission: 'settings.branding.manage', tenantRequired: true, nav: { href: '/settings/branding', label: 'Branding', icon: 'building', group: 'Settings' } },
  // Website setup — temporarily disabled
  // { id: 'settings.website', matcher: '/settings/website', permission: 'settings.website.manage', featureFlag: 'website', tenantRequired: true, nav: { href: '/settings/website', label: 'Website Setup', icon: 'properties', group: 'Settings' } },
  { id: 'settings.seo', matcher: '/settings/seo', permission: 'settings.seo.manage', tenantRequired: true, nav: { href: '/settings/seo', label: 'SEO', icon: 'analytics', group: 'Settings' } },
  { id: 'settings.domains', matcher: '/settings/domains', permission: 'settings.read', featureFlag: 'domains', tenantRequired: true, nav: { href: '/settings/domains', label: 'Domains', icon: 'organizations', group: 'Settings' } },
  { id: 'settings.configuration', matcher: '/settings/configuration', permission: 'settings.configuration.manage', tenantRequired: true, nav: { href: '/settings/configuration', label: 'Configuration', icon: 'settings', group: 'Settings' } },
  { id: 'audit-logs', matcher: '/audit-logs', permission: 'audit.logs.read', tenantRequired: true, nav: { href: '/audit-logs', label: 'Audit Logs', icon: 'audit', group: 'Settings', roles: 'audit' } },
  { id: 'ai.playground', matcher: '/ai/playground', permission: 'ai.qualify', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai/playground', label: 'Assistant Workbench', icon: 'playground', group: 'Advanced' } },
  { id: 'ai.calls', matcher: /^\/ai\/calls(\/.*)?$/, permission: 'ai.calls.read', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai/calls', label: 'Call Logs', icon: 'calls', group: 'Advanced' } },
  { id: 'ai.followups', matcher: '/ai/followups', permission: 'ai.followups.read', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai/followups', label: 'Follow-ups', icon: 'followups', group: 'Advanced' } },
  { id: 'ai.knowledge', matcher: '/ai/knowledge', permission: 'ai.knowledge.read', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai/knowledge', label: 'Knowledge Base', icon: 'knowledge', group: 'Advanced' } },
  { id: 'ai.prompts', matcher: '/ai/prompts', permission: 'ai.prompts.manage', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai/prompts', label: 'Prompt Templates', icon: 'prompts', group: 'Advanced' } },
  { id: 'ai.settings', matcher: '/ai/settings', permission: 'ai.settings.read', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai/settings', label: 'AI Settings', icon: 'settings', group: 'Advanced' } },
  { id: 'ai.dashboard', matcher: /^\/ai(\/.*)?$/, permission: 'ai.dashboard.read', featureFlag: 'ai', tenantRequired: true, nav: { href: '/ai', label: 'AI', icon: 'ai', group: 'Advanced' } },
  { id: 'settings.features', matcher: '/settings/features', permission: 'settings.features.manage', tenantRequired: true, nav: { href: '/settings/features', label: 'Feature Flags', icon: 'sparkles', group: 'Advanced' } },
  { id: 'settings.white-label', matcher: '/settings/white-label', permission: 'settings.whitelabel.manage', tenantRequired: true, nav: { href: '/settings/white-label', label: 'White Label', icon: 'building', group: 'Advanced' } },
  { id: 'settings.public-analytics', matcher: '/settings/public-analytics', permission: 'analytics.public.read', featureFlag: 'analytics', tenantRequired: true },
  { id: 'settings.read', matcher: /^\/settings(\/.*)?$/, permission: 'settings.read', tenantRequired: true },
  { id: 'platform.organizations', matcher: /^\/platform\/organizations(\/.*)?$/, superAdminOnly: true, nav: { href: '/platform/organizations', label: 'Organizations', icon: 'organizations', group: 'Platform', roles: 'super_admin' } },
  { id: 'platform.plans', matcher: /^\/platform\/plans(\/.*)?$/, permission: 'platform.plans.read', superAdminOnly: true, nav: { href: '/platform/plans', label: 'Plans', icon: 'billing', group: 'Platform', roles: 'super_admin' } },
  { id: 'platform.billing', matcher: /^\/platform\/billing(\/.*)?$/, permission: 'platform.billing.read', superAdminOnly: true, nav: { href: '/platform/billing', label: 'Billing', icon: 'performance', group: 'Platform', roles: 'super_admin' } },
  { id: 'platform.payments', matcher: /^\/platform\/payments(\/.*)?$/, permission: 'platform.payment_providers.read', superAdminOnly: true, nav: { href: '/platform/payments', label: 'Payments', icon: 'billing', group: 'Platform', roles: 'super_admin' } },
  { id: 'platform.audit-logs', matcher: /^\/platform\/audit-logs(\/.*)?$/, permission: 'audit.logs.read', superAdminOnly: true, nav: { href: '/platform/audit-logs', label: 'Audit logs', icon: 'audit', group: 'Platform', roles: 'super_admin' } },
];

export const navItems: NavItem[] = routeRegistry
  .filter((route) => route.nav)
  .map((route) => ({
    id: route.id,
    href: route.nav!.href,
    label: route.nav!.label,
    icon: route.nav!.icon,
    roles: route.nav!.roles ?? (route.permission ? 'permission' : 'tenant'),
    permission: route.permission,
    featureFlag: route.featureFlag,
    group: route.nav!.group,
  }));

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

function matchesRoute(matcher: RouteMatcher, pathname: string): boolean {
  if (typeof matcher === 'string') return pathname === matcher;
  if (matcher instanceof RegExp) return matcher.test(pathname);
  return matcher(pathname);
}

function getRouteAccessRule(pathname: string): RouteMetadata | undefined {
  return routeRegistry.find((candidate) => matchesRoute(candidate.matcher, pathname));
}

function isLaunchMode(): boolean {
  return process.env.NEXT_PUBLIC_REOS_LAUNCH_MODE !== 'false';
}

function hasOnlyAssignedSalesRole(session: AuthSession): boolean {
  return (
    session.user.roles.some((role) => ASSIGNED_SALES_ROLES.includes(role)) &&
    !session.user.roles.some((role) => PERFORMANCE_ROLES.includes(role))
  );
}

function isLaunchHiddenNavItem(session: AuthSession, item: NavItem): boolean {
  if (!isLaunchMode()) return false;
  if (item.roles === 'super_admin') return false;
  if (LAUNCH_HIDDEN_NAV_IDS.has(item.id)) return true;
  if (hasOnlyAssignedSalesRole(session)) {
    return item.id === 'analytics' || item.id === 'lead-sources';
  }
  return false;
}

export function isTenantOnlyPath(pathname: string): boolean {
  if (platformSafePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  return tenantOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isLaunchHiddenRoute(session: AuthSession, rule: RouteMetadata | undefined): boolean {
  if (!isLaunchMode() || !rule) return false;
  if (rule.superAdminOnly) return false;
  if (LAUNCH_HIDDEN_NAV_IDS.has(rule.id)) return true;
  if (hasOnlyAssignedSalesRole(session)) {
    return rule.id === 'analytics' || rule.id === 'lead-sources';
  }
  return false;
}

export function getDashboardRouteAccess(session: AuthSession, pathname: string) {
  const rule = getRouteAccessRule(pathname);
  const effective = sessionWithEffectiveTenant(session);
  const impersonating = isImpersonating(session);
  if (!rule) return { allowed: true };

  if (isLaunchHiddenRoute(effective, rule)) {
    return {
      allowed: false,
      reason: 'This module is not available in the current launch preview.',
    };
  }

  if (rule.superAdminOnly) {
    return {
      allowed: isSuperAdmin(session),
      reason: 'This page is only available to platform administrators.',
    };
  }

  if (rule.tenantRequired && (!effective.user.tenant_id || (isSuperAdmin(session) && !impersonating))) {
    return {
      allowed: false,
      reason: 'This page requires an active tenant workspace.',
    };
  }

  if (rule.roles && !effective.user.roles.some((role) => rule.roles?.includes(role))) {
    return {
      allowed: false,
      reason: `This page requires one of: ${rule.roles.join(', ')}.`,
    };
  }

  if (rule.permission && !hasPermission(effective, rule.permission)) {
    return {
      allowed: false,
      reason: `Missing permission: ${rule.permission}.`,
    };
  }

  if (rule.featureFlag && !isFeatureEnabled(effective, rule.featureFlag)) {
    return {
      allowed: false,
      reason: `Feature "${rule.featureFlag}" is disabled for this organization.`,
    };
  }

  return { allowed: true };
}

/** Filter nav items by the session's roles + permissions. */
export function visibleNavFor(session: AuthSession): NavItem[] {
  const superAdmin = isSuperAdmin(session);
  const impersonating = isImpersonating(session);
  const effective = sessionWithEffectiveTenant(session);

  return navItems.filter((item) => {
    if (isLaunchHiddenNavItem(effective, item)) return false;
    if (item.roles === 'all') return true;
    if (item.roles === 'super_admin') return superAdmin;
    if (item.roles === 'performance') {
      return (
        (!superAdmin || impersonating) &&
        effective.user.roles.some((r) => PERFORMANCE_ROLES.includes(r)) &&
        isFeatureEnabled(effective, item.featureFlag)
      );
    }
    if (item.roles === 'audit') return effective.user.permissions.includes('audit.logs.read');
    if (item.roles === 'permission') {
      if (superAdmin && !impersonating) return false;
      if (!effective.user.tenant_id || !item.permission) return false;
      if (!hasPermission(effective, item.permission)) return false;
      return isFeatureEnabled(effective, item.featureFlag);
    }
    return (!superAdmin || impersonating) && !!effective.user.tenant_id;
  });
}
