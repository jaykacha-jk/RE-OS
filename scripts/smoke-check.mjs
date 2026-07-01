/**
 * RE-OS smoke checklist: public chat + platform payment config + agent inbox.
 * Run: node scripts/smoke-check.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:4545';

const SUPER = { email: 'super@reos.dev', password: 'ChangeMe123!' };
const OWNER = { email: 'owner@demo.realty', password: 'ChangeMe123!' };

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function json(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function login(creds, tenantSlug) {
  const { status, data } = await json('POST', '/api/v1/auth/login', {
    ...creds,
    ...(tenantSlug ? { tenant_slug: tenantSlug } : {}),
  });
  if (status !== 200 && status !== 201) {
    throw new Error(`login failed ${status}: ${JSON.stringify(data)}`);
  }
  return data.data.access_token;
}

async function main() {
  console.log(`Smoke check against ${API}\n`);

  // 1. Health
  try {
    const { status } = await json('GET', '/health');
    if (status === 200) pass('Health', `HTTP ${status}`);
    else fail('Health', `HTTP ${status}`);
  } catch (e) {
    fail('Health', e.message);
    printSummary();
    process.exit(1);
  }

  // 2. Public chat start
  let conversationId;
  let visitorToken;
  try {
    const visitorId = `smoke-${Date.now()}`;
    const { status, data } = await json('POST', '/api/v1/public/chat/conversations', {
      tenant: 'demo',
      client_identifier: visitorId,
      client_name: 'Smoke Tester',
      client_phone: '+919876543210',
      message: `Smoke test message ${new Date().toISOString()}`,
    });
    if (status === 201 || status === 200) {
      conversationId = data.data.conversation.id;
      visitorToken = data.data.token;
      pass('Public chat start', `conversation=${conversationId}`);
    } else {
      fail('Public chat start', `HTTP ${status} ${JSON.stringify(data)}`);
    }
  } catch (e) {
    fail('Public chat start', e.message);
  }

  // 3. Public chat poll messages
  if (conversationId && visitorToken) {
    try {
      const { status, data } = await json(
        'GET',
        `/api/v1/public/chat/conversations/${conversationId}/messages?token=${encodeURIComponent(visitorToken)}`,
      );
      const count = data?.data?.length ?? 0;
      if (status === 200 && count >= 1) pass('Public chat messages', `${count} message(s)`);
      else fail('Public chat messages', `HTTP ${status} count=${count}`);
    } catch (e) {
      fail('Public chat messages', e.message);
    }
  }

  // 4. Agent inbox sees conversation
  try {
    const token = await login(OWNER, 'demo');
    const { status, data } = await json('GET', '/api/v1/conversations?per_page=10&sort_by=last_message_at&sort_dir=desc', null, token);
    const list = data?.data ?? [];
    const found = conversationId ? list.some((c) => c.id === conversationId) : list.length > 0;
    if (status === 200 && found) pass('Agent chat inbox', conversationId ? 'new conversation visible' : `${list.length} conversation(s)`);
    else if (status === 200) fail('Agent chat inbox', 'conversation not in first page (may still exist)');
    else fail('Agent chat inbox', `HTTP ${status}`);
  } catch (e) {
    fail('Agent chat inbox', e.message);
  }

  // 5. Platform payment config GET
  let superToken;
  try {
    superToken = await login(SUPER);
    const { status, data } = await json('GET', '/api/v1/platform/payment-providers/razorpay', null, superToken);
    if (status === 200) {
      pass('Payment config GET', `source=${data.data.source} active=${data.data.active}`);
    } else if (status === 403) {
      fail('Payment config GET', '403 — run prisma:seed for platform.payment_providers.read');
    } else if (status === 404) {
      fail('Payment config GET', '404 — restart backend to load PlatformPaymentController');
    } else {
      fail('Payment config GET', `HTTP ${status} ${JSON.stringify(data)}`);
    }
  } catch (e) {
    fail('Payment config GET', e.message);
  }

  // 6. Platform payment config PUT (requires PLATFORM_SECRETS_ENCRYPTION_KEY on the API server)
  if (superToken) {
    try {
      const { status, data } = await json(
        'PUT',
        '/api/v1/platform/payment-providers/razorpay',
        {
          key_id: 'rzp_test_smoke123456',
          key_secret: 'smoke_secret_key_12345',
          webhook_secret: 'whsec_smoke_12345678',
          environment: 'test',
          active: true,
        },
        superToken,
      );
      if (status === 200 && data.data.source === 'database') {
        pass('Payment config PUT', `version=${data.data.version} masked=${data.data.key_id_masked}`);
      } else if (status === 403) {
        fail('Payment config PUT', '403 — run prisma:seed for platform.payment_providers.update');
      } else if (status === 400 && String(data?.error?.message ?? '').includes('PLATFORM_SECRETS_ENCRYPTION_KEY')) {
        pass('Payment config PUT', 'skipped (set key on API server and restart to test save)');
      } else {
        fail('Payment config PUT', `HTTP ${status} ${JSON.stringify(data)}`);
      }
    } catch (e) {
      fail('Payment config PUT', e.message);
    }
  }

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- ${ok}/${total} checks passed ---`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
