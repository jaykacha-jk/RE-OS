import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)).replace(`${sep}scripts`, '');
const dashboardRoot = join(root, 'app', '(dashboard)');
const registryPath = join(root, 'components', 'admin', 'nav-config.ts');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name === 'page.tsx' ? [fullPath] : [];
  });
}

function toRoutePath(pageFile) {
  const withoutPage = dirname(relative(dashboardRoot, pageFile));
  const segments = withoutPage.split(sep).filter((segment) => segment && !segment.startsWith('('));
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

function toConcretePath(routePath) {
  return routePath.replace(/\[[^\]]+\]/g, 'sample-id');
}

function extractMatchers(source) {
  const exact = [...source.matchAll(/matcher:\s*'([^']+)'/g)].map((match) => ({
    kind: 'exact',
    test: (path) => path === match[1],
  }));
  const regexLiterals = [];
  for (const match of source.matchAll(/matcher:\s*\//g)) {
    let cursor = match.index + match[0].lastIndexOf('/');
    let escaped = false;
    let inClass = false;
    cursor += 1;
    while (cursor < source.length) {
      const char = source[cursor];
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '[') {
        inClass = true;
      } else if (char === ']') {
        inClass = false;
      } else if (char === '/' && !inClass) {
        let end = cursor + 1;
        while (/[gimsuy]/.test(source[end] ?? '')) end += 1;
        regexLiterals.push(source.slice(match.index + match[0].lastIndexOf('/'), end));
        break;
      }
      cursor += 1;
    }
  }
  const regex = regexLiterals.map((literal) => {
    const lastSlash = literal.lastIndexOf('/');
    const body = literal.slice(1, lastSlash);
    const flags = literal.slice(lastSlash + 1);
    const pattern = new RegExp(body, flags);
    return {
      kind: 'regex',
      test: (path) => pattern.test(path),
    };
  });
  return [...exact, ...regex];
}

if (!existsSync(registryPath)) {
  throw new Error(`Route registry not found: ${registryPath}`);
}

const registrySource = readFileSync(registryPath, 'utf8');
const matchers = extractMatchers(registrySource);
const missing = walk(dashboardRoot)
  .map(toRoutePath)
  .filter((routePath) => !matchers.some((matcher) => matcher.test(toConcretePath(routePath))));

if (missing.length > 0) {
  console.error('Dashboard routes missing routeRegistry coverage:');
  for (const route of missing) console.error(`- ${route}`);
  process.exit(1);
}

console.log(`Route registry covers ${walk(dashboardRoot).length} dashboard pages.`);
