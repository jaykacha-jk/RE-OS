require('dotenv/config');
const bcrypt = require('bcrypt');
const { createPrismaClient } = require('../dist/common/database/create-prisma-client');

const prisma = createPrismaClient(process.env.DATABASE_URL);

const permissions = [
  { code: 'platform.organizations.create', module: 'platform', description: 'Create organizations' },
  { code: 'platform.organizations.read', module: 'platform', description: 'Read organizations' },
  { code: 'platform.organizations.update', module: 'platform', description: 'Update organizations' },
  { code: 'employees.create', module: 'employees', description: 'Create employees' },
  { code: 'employees.read', module: 'employees', description: 'Read employees' },
  { code: 'employees.update', module: 'employees', description: 'Update employees' },
  { code: 'employees.delete', module: 'employees', description: 'Delete employees' },
  { code: 'properties.create', module: 'properties', description: 'Create properties' },
  { code: 'properties.read', module: 'properties', description: 'Read properties' },
  { code: 'properties.update', module: 'properties', description: 'Update properties' },
  { code: 'properties.delete', module: 'properties', description: 'Delete properties' },
  { code: 'properties.assign', module: 'properties', description: 'Assign properties to employees' },
  { code: 'crm.inquiries.create', module: 'crm', description: 'Create inquiries' },
  { code: 'crm.inquiries.read', module: 'crm', description: 'Read inquiries' },
  { code: 'crm.inquiries.update', module: 'crm', description: 'Update inquiries / change stage' },
  { code: 'crm.inquiries.delete', module: 'crm', description: 'Delete inquiries' },
  { code: 'crm.inquiries.assign', module: 'crm', description: 'Assign inquiries to employees' },
  { code: 'crm.notes.create', module: 'crm', description: 'Add inquiry notes' },
  { code: 'crm.followups.create', module: 'crm', description: 'Create inquiry follow-ups' },
  { code: 'crm.followups.update', module: 'crm', description: 'Update inquiry follow-ups' },
  { code: 'crm.sitevisits.create', module: 'crm', description: 'Schedule site visits' },
  { code: 'crm.sitevisits.update', module: 'crm', description: 'Update site visits' },
  { code: 'crm.lead_sources.read', module: 'crm', description: 'Read lead sources' },
  { code: 'crm.lead_sources.manage', module: 'crm', description: 'Create / update lead sources' },
  { code: 'analytics.read', module: 'analytics', description: 'Read organization / team / assigned analytics' },
  { code: 'platform.analytics.read', module: 'platform', description: 'Read platform-wide analytics (Super Admin)' },
  { code: 'audit.logs.read', module: 'audit', description: 'Read audit logs' },
  { code: 'notifications.read', module: 'notifications', description: 'Read own notifications + manage own preferences' },
  { code: 'notifications.templates.manage', module: 'notifications', description: 'Manage notification templates (admin)' },
  { code: 'chat.conversations.create', module: 'chat', description: 'Create conversations' },
  { code: 'chat.conversations.read', module: 'chat', description: 'Read conversations and messages' },
  { code: 'chat.conversations.update', module: 'chat', description: 'Update / close conversations' },
  { code: 'chat.conversations.assign', module: 'chat', description: 'Assign conversations to employees' },
  { code: 'chat.conversations.convert', module: 'chat', description: 'Convert conversations to CRM inquiries' },
  { code: 'chat.messages.read', module: 'chat', description: 'Read chat messages' },
  { code: 'chat.messages.send', module: 'chat', description: 'Send chat messages' },
  { code: 'billing.plans.read', module: 'billing', description: 'Read billing plans' },
  { code: 'billing.subscription.read', module: 'billing', description: 'Read tenant subscription' },
  { code: 'billing.subscription.update', module: 'billing', description: 'Subscribe, change plan, or cancel subscription' },
  { code: 'billing.invoices.read', module: 'billing', description: 'Read tenant invoices' },
  { code: 'billing.usage.read', module: 'billing', description: 'Read tenant usage against plan limits' },
  { code: 'platform.billing.read', module: 'billing', description: 'Read platform billing revenue metrics' },
  // Phase 9 — Enterprise + White Label Platform (settings, domains, public analytics).
  { code: 'settings.read', module: 'settings', description: 'Read tenant settings (all categories)' },
  { code: 'settings.branding.manage', module: 'settings', description: 'Manage branding settings' },
  { code: 'settings.seo.manage', module: 'settings', description: 'Manage SEO settings' },
  { code: 'settings.website.manage', module: 'settings', description: 'Manage website content settings' },
  { code: 'settings.configuration.manage', module: 'settings', description: 'Manage tenant configuration' },
  { code: 'settings.domains.manage', module: 'settings', description: 'Manage custom domains' },
  { code: 'settings.features.manage', module: 'settings', description: 'Toggle feature flags (Owner)' },
  { code: 'settings.whitelabel.manage', module: 'settings', description: 'Manage white-label settings (Owner)' },
  { code: 'audit.logs.export', module: 'audit', description: 'Export audit logs as CSV' },
  { code: 'analytics.public.read', module: 'analytics', description: 'Read public website analytics' },
  // Phase 10 — AI Agent Platform.
  { code: 'ai.dashboard.read', module: 'ai', description: 'Read AI agent platform dashboard' },
  { code: 'ai.calls.read', module: 'ai', description: 'Read AI calls + transcripts (RBAC scoped)' },
  { code: 'ai.calls.create', module: 'ai', description: 'Initiate AI voice calls' },
  { code: 'ai.agents.manage', module: 'ai', description: 'Create / update AI voice + chat agents' },
  { code: 'ai.chat.use', module: 'ai', description: 'Use the AI chat assistant' },
  { code: 'ai.qualify', module: 'ai', description: 'Run AI lead qualification' },
  { code: 'ai.match', module: 'ai', description: 'Run AI property matching' },
  { code: 'ai.intelligence.read', module: 'ai', description: 'Run AI conversation intelligence' },
  { code: 'ai.followups.read', module: 'ai', description: 'Read AI follow-up suggestions' },
  { code: 'ai.followups.manage', module: 'ai', description: 'Generate / act on AI follow-up suggestions' },
  { code: 'ai.knowledge.read', module: 'ai', description: 'Read AI knowledge base + semantic search' },
  { code: 'ai.knowledge.manage', module: 'ai', description: 'Manage AI knowledge documents' },
  { code: 'ai.prompts.manage', module: 'ai', description: 'Manage AI prompt templates' },
  { code: 'ai.settings.read', module: 'ai', description: 'Read AI settings' },
  { code: 'ai.settings.manage', module: 'ai', description: 'Manage AI settings' },
  { code: 'ai.analytics.read', module: 'ai', description: 'Read AI conversation / conversion / cost analytics' },
];

// Phase 9 RBAC bundles (RBAC.md § Settings).
// Admin = limited settings (no feature flags / white-label toggles).
const settingsAdminPermissions = [
  'settings.read',
  'settings.branding.manage',
  'settings.seo.manage',
  'settings.website.manage',
  'settings.configuration.manage',
  'settings.domains.manage',
  'audit.logs.export',
  'analytics.public.read',
];

// Owner = full settings access.
const settingsOwnerPermissions = [
  ...settingsAdminPermissions,
  'settings.features.manage',
  'settings.whitelabel.manage',
];

// Manager = read-only settings + public analytics.
const settingsManagerPermissions = ['settings.read', 'analytics.public.read'];

// CRM permission bundles (RBAC.md §3 — CRM / Inquiry pipeline).
const crmAllPermissions = [
  'crm.inquiries.create',
  'crm.inquiries.read',
  'crm.inquiries.update',
  'crm.inquiries.delete',
  'crm.inquiries.assign',
  'crm.notes.create',
  'crm.followups.create',
  'crm.followups.update',
  'crm.sitevisits.create',
  'crm.sitevisits.update',
  'crm.lead_sources.read',
  'crm.lead_sources.manage',
];

// Sales manager: team scope — full pipeline ops, no delete, manage own sources read.
const crmManagerPermissions = [
  'crm.inquiries.create',
  'crm.inquiries.read',
  'crm.inquiries.update',
  'crm.inquiries.assign',
  'crm.notes.create',
  'crm.followups.create',
  'crm.followups.update',
  'crm.sitevisits.create',
  'crm.sitevisits.update',
  'crm.lead_sources.read',
];

// Sales executive: assigned scope — work the lead, no assign/delete.
const crmExecutivePermissions = [
  'crm.inquiries.create',
  'crm.inquiries.read',
  'crm.inquiries.update',
  'crm.notes.create',
  'crm.followups.create',
  'crm.followups.update',
  'crm.sitevisits.create',
  'crm.sitevisits.update',
  'crm.lead_sources.read',
];

// Telecaller: assigned scope — update notes and follow-ups only.
const crmTelecallerPermissions = [
  'crm.inquiries.read',
  'crm.notes.create',
  'crm.followups.create',
  'crm.followups.update',
  'crm.lead_sources.read',
];

const propertyAllPermissions = [
  'properties.create',
  'properties.read',
  'properties.update',
  'properties.delete',
  'properties.assign',
];

// Phase 6 — Live Chat permission bundles (RBAC.md § Chat).
const chatAllPermissions = [
  'chat.conversations.create',
  'chat.conversations.read',
  'chat.conversations.update',
  'chat.conversations.assign',
  'chat.conversations.convert',
  'chat.messages.read',
  'chat.messages.send',
];

const chatManagerPermissions = [
  'chat.conversations.create',
  'chat.conversations.read',
  'chat.conversations.update',
  'chat.conversations.assign',
  'chat.conversations.convert',
  'chat.messages.read',
  'chat.messages.send',
];

const chatAssignedPermissions = [
  'chat.conversations.read',
  'chat.conversations.update',
  'chat.conversations.convert',
  'chat.messages.read',
  'chat.messages.send',
];

// Every authenticated role can read its own notifications + set preferences.
const notificationSelfPermissions = ['notifications.read'];
// Admin roles can manage notification templates.
const notificationAdminPermissions = ['notifications.read', 'notifications.templates.manage'];

const billingAdminPermissions = [
  'billing.plans.read',
  'billing.subscription.read',
  'billing.subscription.update',
  'billing.invoices.read',
  'billing.usage.read',
];

const billingReadPermissions = [
  'billing.plans.read',
  'billing.subscription.read',
  'billing.invoices.read',
  'billing.usage.read',
];

// Phase 10 — AI permission bundles (RBAC.md § AI).
// Owner/Admin: full control. Manager: view + use, no config. Sales: own work.
const aiFullPermissions = [
  'ai.dashboard.read',
  'ai.calls.read',
  'ai.calls.create',
  'ai.agents.manage',
  'ai.chat.use',
  'ai.qualify',
  'ai.match',
  'ai.intelligence.read',
  'ai.followups.read',
  'ai.followups.manage',
  'ai.knowledge.read',
  'ai.knowledge.manage',
  'ai.prompts.manage',
  'ai.settings.read',
  'ai.settings.manage',
  'ai.analytics.read',
];

const aiManagerPermissions = [
  'ai.dashboard.read',
  'ai.calls.read',
  'ai.calls.create',
  'ai.chat.use',
  'ai.qualify',
  'ai.match',
  'ai.intelligence.read',
  'ai.followups.read',
  'ai.followups.manage',
  'ai.knowledge.read',
  'ai.settings.read',
  'ai.analytics.read',
];

const aiSalesPermissions = [
  'ai.dashboard.read',
  'ai.calls.read',
  'ai.calls.create',
  'ai.chat.use',
  'ai.qualify',
  'ai.match',
  'ai.followups.read',
  'ai.knowledge.read',
];

const superAdminPermissions = [
  'platform.organizations.create',
  'platform.organizations.read',
  'platform.organizations.update',
  'platform.analytics.read',
  'analytics.read',
  ...propertyAllPermissions,
  ...crmAllPermissions,
  ...chatAllPermissions,
  'audit.logs.read',
  ...notificationAdminPermissions,
  ...billingAdminPermissions,
  'platform.billing.read',
  ...settingsOwnerPermissions,
  ...aiFullPermissions,
];

const orgOwnerPermissions = [
  'employees.create',
  'employees.read',
  'employees.update',
  'employees.delete',
  'analytics.read',
  ...propertyAllPermissions,
  ...crmAllPermissions,
  ...chatAllPermissions,
  'audit.logs.read',
  ...notificationAdminPermissions,
  ...billingAdminPermissions,
  ...settingsOwnerPermissions,
  ...aiFullPermissions,
];

const orgAdminPermissions = [
  'employees.create',
  'employees.read',
  'employees.update',
  'employees.delete',
  'analytics.read',
  ...propertyAllPermissions,
  ...crmAllPermissions,
  ...chatAllPermissions,
  'audit.logs.read',
  ...notificationAdminPermissions,
  ...billingReadPermissions,
  ...settingsAdminPermissions,
  ...aiFullPermissions,
];

// Sales manager: read team properties + update + assign (RBAC.md §3) + team analytics.
const salesManagerPermissions = [
  'properties.read',
  'properties.update',
  'properties.assign',
  'analytics.read',
  ...crmManagerPermissions,
  ...chatManagerPermissions,
  ...notificationSelfPermissions,
  ...settingsManagerPermissions,
  ...aiManagerPermissions,
];

// Sales executive: read + update assigned properties only + assigned analytics.
const salesExecutivePermissions = [
  'properties.read',
  'properties.update',
  'analytics.read',
  ...crmExecutivePermissions,
  ...chatAssignedPermissions,
  ...notificationSelfPermissions,
  ...aiSalesPermissions,
];

// Telecaller: assigned-scope CRM only (notes + follow-ups) + assigned analytics.
const telecallerPermissions = [
  'analytics.read',
  ...crmTelecallerPermissions,
  ...chatAssignedPermissions,
  ...notificationSelfPermissions,
  ...aiSalesPermissions,
];

const plans = [
  {
    code: 'starter',
    name: 'Starter',
    price_inr_monthly: 499900,
    price_inr_yearly: 4999000,
    max_properties: 100,
    max_employees: 5,
    storage_limit_bytes: 5368709120,
    max_ai_minutes_monthly: 60,
    features: { crm: true, dashboard: true, notifications: true, chat: true, ai: true, priority_support: false },
  },
  {
    code: 'pro',
    name: 'Pro',
    price_inr_monthly: 1499900,
    price_inr_yearly: 14999000,
    max_properties: 1000,
    max_employees: 25,
    storage_limit_bytes: 53687091200,
    max_ai_minutes_monthly: 1000,
    features: { crm: true, dashboard: true, notifications: true, chat: true, ai: true, priority_support: true },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price_inr_monthly: 0,
    price_inr_yearly: 0,
    max_properties: 2147483647,
    max_employees: 2147483647,
    storage_limit_bytes: 0,
    max_ai_minutes_monthly: 100000,
    features: { crm: true, dashboard: true, notifications: true, chat: true, ai: true, sso: true, custom_limits: true },
  },
];

const roles = [
  { code: 'super_admin', name: 'Super Admin', is_system: true },
  { code: 'org_owner', name: 'Organization Owner', is_system: true },
  { code: 'org_admin', name: 'Organization Admin', is_system: true },
  { code: 'sales_manager', name: 'Sales Manager', is_system: true },
  { code: 'sales_executive', name: 'Sales Executive', is_system: true },
  { code: 'telecaller', name: 'Telecaller', is_system: true },
];

const SUPER_ADMIN_EMAIL = 'super@reos.dev';
const SUPER_ADMIN_PASSWORD = 'ChangeMe123!';
const DEMO_ORG_SLUG = 'demo';
const DEMO_OWNER_EMAIL = 'owner@demo.realty';
const DEMO_OWNER_PASSWORD = 'ChangeMe123!';
const DEMO_SALES_EMAIL = 'sales@demo.realty';
const DEMO_SALES_PASSWORD = 'ChangeMe123!';

const demoOrganizations = [
  { name: 'Demo Realty', slug: 'demo', city: 'Ahmedabad', tier: 'pro', domain: 'demo.reos.app' },
  { name: 'Aarav Prime Estates', slug: 'aarav-prime', city: 'Ahmedabad', tier: 'pro', domain: 'aaravprime.in' },
  { name: 'Surat Skyline Realty', slug: 'surat-skyline', city: 'Surat', tier: 'starter', domain: 'suratskyline.in' },
  { name: 'Vadodara Urban Homes', slug: 'vadodara-urban', city: 'Vadodara', tier: 'pro', domain: 'vadodaurban.in' },
  { name: 'Gandhinagar Capital Properties', slug: 'capital-properties', city: 'Gandhinagar', tier: 'enterprise', domain: 'capitalproperties.in' },
];

const demoCities = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];
const demoAreas = ['SG Highway', 'South Bopal', 'Science City', 'Prahlad Nagar', 'Satellite', 'Bopal', 'Thaltej'];
const demoNames = [
  'Raj Patel',
  'Priya Shah',
  'Amit Mehta',
  'Nisha Desai',
  'Kunal Trivedi',
  'Riya Joshi',
  'Harsh Vyas',
  'Neha Parikh',
  'Dev Shah',
  'Ananya Mehta',
];
const demoRoles = ['org_owner', 'org_admin', 'sales_manager', 'sales_executive', 'sales_executive', 'sales_executive', 'telecaller', 'telecaller', 'sales_manager', 'sales_executive'];
const demoLeadSources = ['Website', 'Property Portal', 'WhatsApp', 'Facebook', 'Google Ads', 'Referral', 'Walk-in'];
const demoPropertyShapes = [
  { category: 'villa', type: 'residential', label: 'Luxury Villa', basePrice: 32500000, bedrooms: 4, area: 3200 },
  { category: 'flat', type: 'residential', label: 'Premium Apartment', basePrice: 9500000, bedrooms: 3, area: 1450 },
  { category: 'plot', type: 'residential', label: 'Residential Plot', basePrice: 7800000, bedrooms: null, area: 2200 },
  { category: 'office', type: 'commercial', label: 'Commercial Office', basePrice: 18500000, bedrooms: null, area: 1800 },
  { category: 'shop', type: 'commercial', label: 'Retail Shop', basePrice: 12500000, bedrooms: null, area: 650 },
  { category: 'warehouse', type: 'commercial', label: 'Warehouse', basePrice: 28000000, bedrooms: null, area: 9000 },
];
const demoImages = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
];

async function seedPermissions() {
  await prisma.permissions.createMany({ data: permissions, skipDuplicates: true });
}

async function seedPlans() {
  for (const plan of plans) {
    await prisma.subscription_plans.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        price_inr_monthly: plan.price_inr_monthly,
        price_inr_yearly: plan.price_inr_yearly,
        max_properties: plan.max_properties,
        max_employees: plan.max_employees,
        storage_limit_bytes: plan.storage_limit_bytes,
        max_ai_minutes_monthly: plan.max_ai_minutes_monthly,
        features: plan.features,
        is_active: true,
      },
      create: plan,
    });
  }
}

async function seedRoles() {
  for (const role of roles) {
    const existing = await prisma.roles.findFirst({
      where: { tenant_id: null, code: role.code },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.roles.create({
      data: {
        tenant_id: null,
        code: role.code,
        name: role.name,
        is_system: role.is_system,
      },
    });
  }
}

async function seedRolePermissions(roleCode, permissionCodes) {
  const role = await prisma.roles.findFirst({ where: { tenant_id: null, code: roleCode } });
  if (!role) return;

  for (const code of permissionCodes) {
    const permission = await prisma.permissions.findUnique({ where: { code } });
    if (!permission) continue;

    await prisma.role_permissions.upsert({
      where: {
        role_id_permission_id: {
          role_id: role.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: { role_id: role.id, permission_id: permission.id },
    });
  }
}

async function seedSuperAdminUser() {
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  const existing = await prisma.users.findFirst({
    where: { email: SUPER_ADMIN_EMAIL, tenant_id: null },
  });

  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        password_hash: passwordHash,
        status: 'active',
        user_type: 'super_admin',
        failed_login_count: 0,
        locked_until: null,
      },
    });
    return;
  }

  await prisma.users.create({
    data: {
      email: SUPER_ADMIN_EMAIL,
      tenant_id: null,
      password_hash: passwordHash,
      first_name: 'Super',
      last_name: 'Admin',
      user_type: 'super_admin',
      status: 'active',
        failed_login_count: 0,
        locked_until: null,
    },
  });
}

async function seedDemoOrganization() {
  let org = await prisma.organizations.findFirst({
    where: { slug: DEMO_ORG_SLUG, deleted_at: null },
  });

  if (!org) {
    org = await prisma.organizations.create({
      data: {
        name: 'Demo Realty',
        slug: DEMO_ORG_SLUG,
        billing_email: DEMO_OWNER_EMAIL,
        status: 'trial',
        tier: 'pro',
      },
    });
    await prisma.organization_usage.create({ data: { tenant_id: org.id } });
  }

  const ownerRole = await prisma.roles.findFirst({
    where: { tenant_id: null, code: 'org_owner' },
  });
  if (!ownerRole) return org;

  const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, 12);
  let owner = await prisma.users.findFirst({
    where: { tenant_id: org.id, email: DEMO_OWNER_EMAIL },
  });

  if (!owner) {
    owner = await prisma.users.create({
      data: {
        tenant_id: org.id,
        email: DEMO_OWNER_EMAIL,
        password_hash: passwordHash,
        first_name: 'Demo',
        last_name: 'Owner',
        user_type: 'internal',
        status: 'active',
      },
    });
    await prisma.user_roles.create({
      data: { user_id: owner.id, role_id: ownerRole.id, tenant_id: org.id },
    });
    await prisma.employees.create({
      data: { user_id: owner.id, status: 'active', joined_at: new Date() },
    });
    await prisma.organization_usage.update({
      where: { tenant_id: org.id },
      data: { employees_count: { increment: 1 } },
    });
  } else {
    await prisma.users.update({
      where: { id: owner.id },
      data: {
        password_hash: passwordHash,
        status: 'active',
        failed_login_count: 0,
        locked_until: null,
      },
    });
  }

  return org;
}

async function seedDemoSalesExecutive(org) {
  const salesRole = await prisma.roles.findFirst({
    where: { tenant_id: null, code: 'sales_executive' },
  });
  if (!salesRole) return;

  const passwordHash = await bcrypt.hash(DEMO_SALES_PASSWORD, 12);
  let user = await prisma.users.findFirst({
    where: { tenant_id: org.id, email: DEMO_SALES_EMAIL },
  });

  if (!user) {
    user = await prisma.users.create({
      data: {
        tenant_id: org.id,
        email: DEMO_SALES_EMAIL,
        password_hash: passwordHash,
        first_name: 'Demo',
        last_name: 'Sales',
        user_type: 'internal',
        status: 'active',
      },
    });
    await prisma.user_roles.create({
      data: { user_id: user.id, role_id: salesRole.id, tenant_id: org.id },
    });
    await prisma.employees.create({
      data: { user_id: user.id, status: 'active', joined_at: new Date() },
    });
    await prisma.organization_usage.update({
      where: { tenant_id: org.id },
      data: { employees_count: { increment: 1 } },
    });
  } else {
    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        status: 'active',
        failed_login_count: 0,
        locked_until: null,
      },
    });
  }
}

async function seedDefaultLeadSources(org) {
  const defaults = [
    { name: 'Website', code: 'website' },
    { name: 'Property Portal', code: 'portal' },
    { name: 'WhatsApp', code: 'whatsapp' },
    { name: 'Facebook', code: 'facebook' },
    { name: 'Google Ads', code: 'google_ads' },
    { name: 'Referral', code: 'referral' },
    { name: 'Walk-in', code: 'walk_in' },
  ];
  for (const source of defaults) {
    const existing = await prisma.lead_sources.findFirst({
      where: { tenant_id: org.id, name: source.name, deleted_at: null },
    });
    if (existing) continue;
    await prisma.lead_sources.create({
      data: {
        tenant_id: org.id,
        name: source.name,
        code: source.code,
        is_active: true,
        is_system: true,
      },
    });
  }
}

// --- Phase 10: AI system prompt templates + demo knowledge -------------------

const aiPromptTemplates = [
  {
    key: 'chat_assistant',
    name: 'Chat Assistant (System)',
    description: 'Default system prompt for the website/CRM AI chat assistant.',
    system_prompt:
      'You are a helpful, concise real-estate sales assistant for an Indian property agency. ' +
      'Help website and CRM visitors with property availability, pricing, FAQs, and booking site visits. ' +
      'Use the provided KNOWLEDGE CONTEXT when answering. If you do not know, say so and offer to connect a human advisor. ' +
      'Always try to capture the visitor budget, preferred location, and property type. Keep replies under 80 words.',
  },
  {
    key: 'qualification',
    name: 'Lead Qualification (System)',
    description: 'Guidance for extracting structured requirements and scoring intent.',
    system_prompt:
      'Extract budget, city, area, property type, requirement type (buy/sell/rent), bedrooms, timeline, and financing need ' +
      'from the conversation. Return only what is explicitly stated. Classify intent as hot, warm, or cold based on budget clarity, ' +
      'timeline urgency, requirement completeness, and engagement.',
  },
  {
    key: 'call_summary',
    name: 'Call Summary (System)',
    description: 'Guidance for summarizing a recorded call.',
    system_prompt:
      'Summarize the call in 2-3 sentences. Capture the client requirement, sentiment, objections, and the agreed next action. ' +
      'Be factual and avoid inventing details not present in the transcript.',
  },
  {
    key: 'intelligence',
    name: 'Conversation Intelligence (System)',
    description: 'Guidance for extracting objections, buying signals, and risks.',
    system_prompt:
      'Analyze the conversation and list objections, buying signals, and risk indicators. Recommend concrete next actions ' +
      'for the sales agent. Respect TRAI compliance — never recommend contacting opted-out clients.',
  },
];

async function seedAiPromptTemplates() {
  for (const t of aiPromptTemplates) {
    const existing = await prisma.ai_prompt_templates.findFirst({
      where: { tenant_id: null, key: t.key },
      select: { id: true },
    });
    if (existing) {
      await prisma.ai_prompt_templates.update({
        where: { id: existing.id },
        data: { name: t.name, description: t.description, system_prompt: t.system_prompt, is_system: true },
      });
      continue;
    }
    await prisma.ai_prompt_templates.create({
      data: {
        tenant_id: null,
        key: t.key,
        name: t.name,
        description: t.description,
        system_prompt: t.system_prompt,
        is_system: true,
        is_active: true,
      },
    });
  }
}

// Mirrors MockAiProvider.hashingEmbedding so seeded docs are RAG-retrievable
// with the default mock provider (128 dims, md5 feature hashing, L2-normalized).
function hashingEmbedding(text, dimensions = 128) {
  const crypto = require('crypto');
  const vector = new Array(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const token of tokens) {
    const hash = crypto.createHash('md5').update(token).digest();
    const bucket = hash.readUInt32BE(0) % dimensions;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[bucket] += sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

async function seedDemoAi(org) {
  // AI settings (mock provider so it runs without keys).
  await prisma.ai_settings.upsert({
    where: { tenant_id: org.id },
    update: {},
    create: { tenant_id: org.id, provider: 'mock' },
  });

  const docs = [
    {
      type: 'faq',
      title: 'Site visit booking',
      content:
        'Site visits can be booked any day between 10am and 7pm. We offer free cab pickup for visits to projects on SG Highway and Bopal. Visits are confirmed within 2 hours of request.',
    },
    {
      type: 'faq',
      title: 'Home loan assistance',
      content:
        'We have tie-ups with HDFC, SBI, and ICICI for home loans up to 90 percent of property value. Our loan desk helps with pre-approval, documentation, and EMI planning.',
    },
    {
      type: 'policy',
      title: 'Booking and token policy',
      content:
        'A refundable booking token of 1 lakh reserves a unit for 7 days. The token is adjusted into the down payment on agreement signing and is fully refundable if the bank rejects the loan.',
    },
    {
      type: 'document',
      title: 'Popular localities and pricing',
      content:
        'SG Highway 3 BHK apartments range from 90 lakhs to 1.4 crore. Bopal 2 BHK flats start around 55 lakhs. Commercial showrooms on Prahlad Nagar start at 1.2 crore.',
    },
  ];

  for (const d of docs) {
    const existing = await prisma.ai_knowledge_documents.findFirst({
      where: { tenant_id: org.id, title: d.title, deleted_at: null },
      select: { id: true },
    });
    if (existing) continue;
    const embedding = hashingEmbedding(`${d.title}\n${d.content}`);
    await prisma.ai_knowledge_documents.create({
      data: {
        tenant_id: org.id,
        type: d.type,
        title: d.title,
        content: d.content,
        source_type: 'manual',
        embedding,
        embedding_model: 'mock:mock-embed-128',
        tokens: Math.ceil((d.title.length + d.content.length) / 4),
        is_active: true,
      },
    });
  }

  // A default voice agent for the demo org.
  const existingAgent = await prisma.ai_agents.findFirst({
    where: { tenant_id: org.id, deleted_at: null },
    select: { id: true },
  });
  if (!existingAgent) {
    await prisma.ai_agents.create({
      data: {
        tenant_id: org.id,
        name: 'Demo Voice Agent',
        type: 'voice',
        phone_number: '+919900000000',
        call_provider: 'mock',
        status: 'active',
      },
    });
  }
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function cleanupDemoTenant(tenantId) {
  await prisma.conversations.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.notifications.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.public_analytics_events.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.invoices.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.subscriptions.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.inquiries.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.properties.deleteMany({ where: { tenant_id: tenantId } });
}

async function createDemoEmployee(org, index, roleCode, passwordHash) {
  const [firstName, lastName] = demoNames[index % demoNames.length].split(' ');
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@${org.slug}.reos.demo`;
  const role = await prisma.roles.findFirst({ where: { tenant_id: null, code: roleCode } });
  if (!role) return null;

  const user = await prisma.users.upsert({
    where: { tenant_id_email: { tenant_id: org.id, email } },
    update: {
      first_name: firstName,
      last_name: lastName,
      phone: `+91${9000000000 + index + org.slug.length * 1000}`,
      password_hash: passwordHash,
      status: 'active',
      failed_login_count: 0,
      locked_until: null,
    },
    create: {
      tenant_id: org.id,
      email,
      phone: `+91${9000000000 + index + org.slug.length * 1000}`,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      user_type: 'internal',
      status: 'active',
    },
  });

  const existingRole = await prisma.user_roles.findFirst({
    where: { user_id: user.id, role_id: role.id, tenant_id: org.id },
  });
  if (!existingRole) {
    await prisma.user_roles.create({ data: { user_id: user.id, role_id: role.id, tenant_id: org.id } });
  }

  return prisma.employees.upsert({
    where: { user_id: user.id },
    update: {
      employee_code: `${org.slug.toUpperCase().slice(0, 3)}-EMP-${String(index + 1).padStart(3, '0')}`,
      department: roleCode.includes('sales') ? 'Sales' : roleCode === 'telecaller' ? 'Calling' : 'Operations',
      status: 'active',
    },
    create: {
      user_id: user.id,
      employee_code: `${org.slug.toUpperCase().slice(0, 3)}-EMP-${String(index + 1).padStart(3, '0')}`,
      department: roleCode.includes('sales') ? 'Sales' : roleCode === 'telecaller' ? 'Calling' : 'Operations',
      status: 'active',
      joined_at: daysAgo(120 - index),
    },
    include: { user: true },
  });
}

async function seedTenantSettings(org) {
  const rows = [
    ['branding', { primaryColor: '#0f766e', accentColor: '#b7791f', font: 'Plus Jakarta Sans' }],
    ['website', { heroTitle: `${org.name} verified properties`, city: org.city, phone: '+91 98765 43210' }],
    ['seo', { titleTemplate: `%s | ${org.name}`, defaultCity: org.city, indexPublicPages: true }],
    ['features', { crm: true, chat: true, publicWebsite: true, billing: true, ai: true }],
    ['configuration', { currency: 'INR', timezone: 'Asia/Kolkata', locale: 'en-IN' }],
    ['white_label', { enabled: org.tier !== 'starter', hideReosBranding: org.tier === 'enterprise' }],
  ];

  for (const [category, data] of rows) {
    await prisma.tenant_settings.upsert({
      where: { tenant_id_category: { tenant_id: org.id, category } },
      update: { data },
      create: { tenant_id: org.id, category, data },
    });
  }
}

async function seedDemoBilling(org) {
  const plan = await prisma.subscription_plans.findFirst({
    where: { code: org.tier === 'enterprise' ? 'enterprise' : org.tier === 'starter' ? 'starter' : 'pro' },
  });
  if (!plan) return;

  const subscription = await prisma.subscriptions.create({
    data: {
      tenant_id: org.id,
      plan_id: plan.id,
      status: org.tier === 'starter' ? 'trial' : 'active',
      billing_cycle: 'monthly',
      provider: 'mock',
      provider_subscription_id: `demo-sub-${org.slug}`,
      provider_customer_id: `demo-cus-${org.slug}`,
      current_period_start: daysAgo(12),
      current_period_end: daysFromNow(18),
      trial_ends_at: org.tier === 'starter' ? daysFromNow(8) : null,
    },
  });

  // 20 monthly invoices per org (→ 100 invoices across 5 orgs), ~20 months history.
  for (let i = 0; i < 20; i += 1) {
    const subtotal = plan.price_inr_monthly || 2499900;
    const tax = Math.round(subtotal * 0.18);
    await prisma.invoices.create({
      data: {
        tenant_id: org.id,
        subscription_id: subscription.id,
        plan_id: plan.id,
        invoice_number: `${org.slug.toUpperCase()}-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
        subtotal,
        tax,
        total: subtotal + tax,
        status: i === 0 && org.tier === 'starter' ? 'open' : 'paid',
        issued_at: daysAgo(i * 30 + 3),
        due_at: daysFromNow(10 - i * 30),
        paid_at: i === 0 && org.tier === 'starter' ? null : daysAgo(i * 30 + 1),
      },
    });
  }
}

async function seedDemoProperties(org, employees) {
  const properties = [];
  for (let i = 0; i < 100; i += 1) {
    const shape = demoPropertyShapes[i % demoPropertyShapes.length];
    const area = demoAreas[i % demoAreas.length];
    const city = i % 5 === 0 ? org.city : demoCities[i % demoCities.length];
    const status = ['published', 'published', 'published', 'reserved', 'sold', 'draft'][i % 6];
    const title = `${shape.label} ${i + 1} near ${area}`;
    const property = await prisma.properties.create({
      data: {
        tenant_id: org.id,
        property_code: `${org.slug.toUpperCase().slice(0, 3)}-PROP-${String(i + 1).padStart(4, '0')}`,
        title,
        slug: `${slugify(title)}-${org.slug}`,
        description: `${title} in ${city} with verified documents, assigned sales owner, and site-visit-ready inventory for serious buyers.`,
        type: shape.type,
        category: shape.category,
        requirement_type: shape.type === 'commercial' && i % 3 === 0 ? 'rent' : 'buy',
        price: shape.basePrice + i * 175000,
        maintenance: shape.type === 'commercial' ? 25000 + i * 100 : 5000 + i * 50,
        token_amount: 100000 + i * 2500,
        address: `${area}, ${city}`,
        city,
        state: 'Gujarat',
        country: 'India',
        pincode: String(380000 + (i % 90)),
        bedrooms: shape.bedrooms,
        bathrooms: shape.bedrooms ? Math.max(2, shape.bedrooms - 1) : null,
        balconies: shape.bedrooms ? 2 : null,
        floor: shape.category === 'flat' || shape.category === 'office' ? (i % 12) + 1 : null,
        total_floors: shape.category === 'flat' || shape.category === 'office' ? 14 : null,
        super_builtup_area: shape.area,
        carpet_area: Math.round(shape.area * 0.72),
        status,
        is_public: status === 'published',
        meta_title: `${title} in ${city}`,
        meta_description: `Explore ${title} in ${area}, ${city}. Book a verified site visit with ${org.name}.`,
        published_at: status === 'published' ? daysAgo(i % 20) : null,
      },
    });

    // At least 5 images per property (BR — listing gallery completeness).
    await prisma.property_images.createMany({
      data: Array.from({ length: 6 }, (_, idx) => {
        const url = demoImages[(i + idx) % demoImages.length];
        return {
          tenant_id: org.id,
          property_id: property.id,
          url,
          thumbnail_url: url,
          alt_text: `${title} — view ${idx + 1}`,
          sort_order: idx,
          is_cover: idx === 0,
        };
      }),
    });
    await prisma.property_amenities.createMany({
      data: ['Parking', 'Security', 'Lift', 'Power Backup', 'Club House'].slice(0, 3 + (i % 3)).map((name) => ({
        tenant_id: org.id,
        property_id: property.id,
        name,
      })),
      skipDuplicates: true,
    });
    await prisma.property_tags.createMany({
      data: ['Verified', area, city, shape.label].map((tag) => ({ tenant_id: org.id, property_id: property.id, tag })),
      skipDuplicates: true,
    });
    const employee = employees[i % employees.length];
    if (employee) {
      await prisma.property_assignments.create({
        data: { tenant_id: org.id, property_id: property.id, employee_id: employee.id, is_primary: true },
      });
    }

    // Property history timeline (created → price change → status change).
    await prisma.property_history.createMany({
      data: [
        {
          tenant_id: org.id,
          property_id: property.id,
          change_type: 'created',
          changed_fields: { status: 'draft' },
          changed_by_email: employee?.user?.email ?? null,
          created_at: daysAgo((i % 30) + 6),
        },
        {
          tenant_id: org.id,
          property_id: property.id,
          change_type: 'price_changed',
          changed_fields: { price: { from: shape.basePrice, to: shape.basePrice + i * 175000 } },
          changed_by_email: employee?.user?.email ?? null,
          created_at: daysAgo((i % 20) + 3),
        },
        {
          tenant_id: org.id,
          property_id: property.id,
          change_type: 'status_changed',
          changed_fields: { status: { to: status } },
          changed_by_email: employee?.user?.email ?? null,
          created_at: daysAgo(i % 10),
        },
      ],
    });
    properties.push(property);
  }
  return properties;
}

async function seedDemoInquiries(org, employees, properties, leadSources) {
  const inquiries = [];
  const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_COMPLETED', 'NEGOTIATION', 'BOOKED', 'CLOSED_WON', 'CLOSED_LOST'];
  for (let i = 0; i < 60; i += 1) {
    const property = properties[i % properties.length];
    const employee = employees[i % employees.length];
    const source = leadSources[i % leadSources.length];
    const name = demoNames[i % demoNames.length];
    const stage = stages[i % stages.length];
    const inquiry = await prisma.inquiries.create({
      data: {
        tenant_id: org.id,
        inquiry_code: `${org.slug.toUpperCase().slice(0, 3)}-INQ-${String(i + 1).padStart(4, '0')}`,
        property_id: property.id,
        assigned_employee_id: employee?.id,
        source_id: source?.id,
        source_name: source?.name ?? 'Website',
        client_name: name,
        phone: `+91${8000000000 + i + org.slug.length * 1000}`,
        email: `${slugify(name)}${i}@example.com`,
        whatsapp: `+91${8000000000 + i + org.slug.length * 1000}`,
        budget_min: 6000000 + i * 125000,
        budget_max: 16000000 + i * 250000,
        requirement_type: property.requirement_type,
        preferred_location: demoAreas[i % demoAreas.length],
        property_type: property.type,
        bedrooms: property.bedrooms,
        purchase_timeline: ['immediate', '1_3_months', '3_6_months', 'exploring'][i % 4],
        stage,
        priority: i % 5 === 0 ? 'high' : i % 3 === 0 ? 'low' : 'medium',
        temperature: i % 4 === 0 ? 'hot' : i % 3 === 0 ? 'cold' : 'warm',
        lead_score: 45 + (i % 55),
        closed_at: stage === 'CLOSED_WON' || stage === 'CLOSED_LOST' ? daysAgo(i % 15) : null,
        lost_reason: stage === 'CLOSED_LOST' ? 'Budget mismatch' : null,
        remarks: 'Demo lead generated for investor/customer walkthrough.',
        created_at: daysAgo(i % 45),
      },
    });

    await prisma.inquiry_activities.createMany({
      data: [
        { tenant_id: org.id, inquiry_id: inquiry.id, activity_type: 'inquiry_created', content: `Inquiry captured from ${source?.name ?? 'Website'}`, actor_email: employee?.user?.email },
        { tenant_id: org.id, inquiry_id: inquiry.id, activity_type: 'inquiry_assigned', content: `Assigned to ${employee?.user?.first_name ?? 'sales owner'}`, actor_email: employee?.user?.email },
        { tenant_id: org.id, inquiry_id: inquiry.id, activity_type: 'stage_changed', content: `Moved to ${stage}`, actor_email: employee?.user?.email },
      ],
    });
    await prisma.inquiry_followups.create({
      data: {
        tenant_id: org.id,
        inquiry_id: inquiry.id,
        assigned_employee_id: employee?.id,
        followup_date: daysFromNow((i % 10) + 1),
        followup_time: `${10 + (i % 7)}:30`,
        followup_type: ['call', 'whatsapp', 'site_visit', 'meeting'][i % 4],
        status: i % 6 === 0 ? 'completed' : 'pending',
        notes: 'Confirm availability and shortlist matching properties.',
      },
    });

    // CRM notes — manual notes left by the sales owner on the lead.
    await prisma.inquiry_notes.createMany({
      data: [
        {
          tenant_id: org.id,
          inquiry_id: inquiry.id,
          note: `Budget confirmed around ₹${60 + (i % 40)} lakh. Prefers ${demoAreas[i % demoAreas.length]}, ${property.bedrooms ?? 2} BHK.`,
          created_by_email: employee?.user?.email ?? null,
          created_at: daysAgo((i % 20) + 1),
        },
        {
          tenant_id: org.id,
          inquiry_id: inquiry.id,
          note: 'Shared matching listings on WhatsApp. Awaiting shortlist before scheduling a site visit.',
          created_by_email: employee?.user?.email ?? null,
          created_at: daysAgo(i % 9),
        },
      ],
    });
    if (i % 3 === 0) {
      await prisma.site_visits.create({
        data: {
          tenant_id: org.id,
          inquiry_id: inquiry.id,
          property_id: property.id,
          employee_id: employee?.id,
          scheduled_at: daysFromNow((i % 14) + 1),
          status: i % 6 === 0 ? 'completed' : 'scheduled',
          notes: 'Demo site visit for qualified buyer.',
        },
      });
    }
    inquiries.push(inquiry);
  }
  return inquiries;
}

async function seedDemoConversations(org, employees, properties, inquiries) {
  for (let i = 0; i < 20; i += 1) {
    const property = properties[i % properties.length];
    const inquiry = inquiries[i % inquiries.length];
    const employee = employees[i % employees.length];
    const conversation = await prisma.conversations.create({
      data: {
        tenant_id: org.id,
        conversation_code: `${org.slug.toUpperCase().slice(0, 3)}-CHAT-${String(i + 1).padStart(4, '0')}`,
        type: i % 3 === 0 ? 'whatsapp' : 'website',
        status: i % 7 === 0 ? 'closed' : 'open',
        subject: `Inquiry about ${property.title}`,
        property_id: property.id,
        property_slug: property.slug,
        inquiry_id: inquiry.id,
        client_name: inquiry.client_name,
        client_email: inquiry.email,
        client_phone: inquiry.phone,
        assigned_employee_id: employee?.id,
        last_message_at: daysAgo(i % 8),
        last_message_preview: 'Can we schedule a site visit this weekend?',
      },
    });
    // A realistic 10-message thread per conversation (→ ~1000 messages total).
    const clientLines = [
      'Is this property still available?',
      'What is the final price and is it negotiable?',
      'Are home loans available for this unit?',
      'Can we schedule a site visit this weekend?',
      'Please share the floor plan and nearby amenities.',
    ];
    const agentLines = [
      'Yes, it is available. I can share available visit slots.',
      'The price is firm but we can discuss on the booking token. ',
      'We have tie-ups with HDFC and SBI for up to 90% financing.',
      'Sure — Saturday 11am or Sunday 4pm both work. Which suits you?',
      'Sharing the floor plan now. The project has a clubhouse and covered parking.',
    ];
    const messageData = [];
    for (let m = 0; m < 10; m += 1) {
      const isClient = m % 2 === 0;
      messageData.push({
        tenant_id: org.id,
        conversation_id: conversation.id,
        sender_type: isClient ? 'client' : 'employee',
        sender_id: isClient ? null : employee?.user_id,
        sender_name: isClient ? inquiry.client_name : employee?.user?.first_name ?? 'Sales',
        content: isClient ? clientLines[(m / 2) % clientLines.length] : agentLines[((m - 1) / 2) % agentLines.length],
        status: m >= 8 ? 'delivered' : 'read',
        created_at: daysAgo(((10 - m) % 8) + (i % 4)),
      });
    }
    await prisma.messages.createMany({ data: messageData });
    await prisma.conversation_assignments.create({
      data: { tenant_id: org.id, conversation_id: conversation.id, employee_id: employee.id },
    });
  }
}

async function seedDemoNotificationsAndAnalytics(org, users, properties, inquiries) {
  // 40 notifications per org (→ 200 across 5 orgs).
  const notificationTitles = [
    'Hot lead needs follow-up',
    'New inquiry assigned to you',
    'Site visit scheduled',
    'Invoice payment received',
    'Property published to website',
  ];
  for (let i = 0; i < 40; i += 1) {
    const user = users[i % users.length];
    const inquiry = inquiries[i % inquiries.length];
    const titleIdx = i % notificationTitles.length;
    await prisma.notifications.create({
      data: {
        tenant_id: org.id,
        user_id: user.id,
        title: notificationTitles[titleIdx],
        message: `${inquiry.client_name} is waiting for a response on ${inquiry.preferred_location}.`,
        type: titleIdx === 0 || titleIdx === 1 ? 'CRM' : titleIdx === 3 ? 'BILLING' : 'SYSTEM',
        priority: titleIdx === 0 ? 'HIGH' : i % 3 === 0 ? 'LOW' : 'MEDIUM',
        action_url: `/inquiries/${inquiry.id}`,
        entity_type: 'inquiry',
        entity_id: inquiry.id,
        metadata: { demo_seed: true },
        is_read: i % 3 === 0,
        read_at: i % 3 === 0 ? daysAgo(1) : null,
        created_at: daysAgo(i % 25),
      },
    });
  }

  // Public website analytics spread across the last 12 months (≈ 72 events/org).
  const eventTypes = ['page_view', 'property_view', 'property_click', 'inquiry_conversion'];
  const analyticsData = [];
  for (let i = 0; i < 72; i += 1) {
    const property = properties[i % properties.length];
    // Spread evenly across 360 days so monthly analytics rollups are populated.
    const createdAt = daysAgo(Math.floor((i / 72) * 360) + (i % 5));
    analyticsData.push({
      tenant_id: org.id,
      event_type: eventTypes[i % eventTypes.length],
      entity_type: 'property',
      entity_id: property.id,
      path: `/buy/${slugify(property.city)}/${property.slug}`,
      referrer: i % 2 === 0 ? 'https://google.com' : 'https://instagram.com',
      source: i % 2 === 0 ? 'organic' : 'social',
      session_id: `demo-session-${org.slug}-${i}`,
      user_agent: 'Demo Browser',
      ip_hash: `demo-ip-${org.slug}-${i}`,
      created_at: createdAt,
    });
  }
  await prisma.public_analytics_events.createMany({ data: analyticsData });
}

async function seedCompleteDemoExperience() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  for (const config of demoOrganizations) {
    const org = await prisma.organizations.upsert({
      where: { slug: config.slug },
      update: {
        name: config.name,
        billing_email: `billing@${config.slug}.reos.demo`,
        status: config.tier === 'starter' ? 'trial' : 'active',
        tier: config.tier,
        custom_domain: config.domain,
      },
      create: {
        name: config.name,
        slug: config.slug,
        billing_email: `billing@${config.slug}.reos.demo`,
        status: config.tier === 'starter' ? 'trial' : 'active',
        tier: config.tier,
        custom_domain: config.domain,
      },
    });

    await prisma.organization_usage.upsert({
      where: { tenant_id: org.id },
      update: {},
      create: { tenant_id: org.id },
    });
    await cleanupDemoTenant(org.id);
    await seedDefaultLeadSources(org);
    await seedTenantSettings({ ...org, city: config.city, tier: config.tier });

    const employees = [];
    for (let i = 0; i < 10; i += 1) {
      const employee = await createDemoEmployee(org, i, demoRoles[i % demoRoles.length], passwordHash);
      if (employee) employees.push(employee);
    }

    const leadSources = await prisma.lead_sources.findMany({ where: { tenant_id: org.id, deleted_at: null } });
    const properties = await seedDemoProperties({ ...org, city: config.city }, employees);
    const inquiries = await seedDemoInquiries(org, employees, properties, leadSources);
    await seedDemoConversations(org, employees, properties, inquiries);
    await seedDemoBilling({ ...org, tier: config.tier });
    await seedDemoNotificationsAndAnalytics(org, employees.map((e) => e.user), properties, inquiries);

    await prisma.organization_usage.update({
      where: { tenant_id: org.id },
      data: {
        properties_count: properties.length,
        employees_count: employees.length,
        storage_bytes: BigInt(properties.length * 3500000),
        ai_minutes_used: 120 + properties.length,
      },
    });
  }
}

async function main() {
  await seedPermissions();
  await seedPlans();
  await seedRoles();
  await seedRolePermissions('super_admin', superAdminPermissions);
  await seedRolePermissions('org_owner', orgOwnerPermissions);
  await seedRolePermissions('org_admin', orgAdminPermissions);
  await seedRolePermissions('sales_manager', salesManagerPermissions);
  await seedRolePermissions('sales_executive', salesExecutivePermissions);
  await seedRolePermissions('telecaller', telecallerPermissions);
  await seedAiPromptTemplates();
  await seedSuperAdminUser();
  const org = await seedDemoOrganization();
  if (org) {
    await seedDemoSalesExecutive(org);
    await seedDefaultLeadSources(org);
    await seedDemoAi(org);
  }
  await seedCompleteDemoExperience();
  console.log('Seed completed');
  console.log(`Super admin: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
  console.log(`Demo owner: ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD} (slug: ${DEMO_ORG_SLUG})`);
  console.log(`Demo sales exec: ${DEMO_SALES_EMAIL} / ${DEMO_SALES_PASSWORD} (slug: ${DEMO_ORG_SLUG})`);
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
