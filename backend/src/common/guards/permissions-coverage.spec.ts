import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const HTTP_DECORATOR = /^\s*@(Get|Post|Patch|Put|Delete)\b/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.controller.ts') ? [fullPath] : [];
  });
}

describe('protected controller permission coverage', () => {
  it('requires every PermissionsGuard route to declare permissions or AuthOnly', () => {
    const srcRoot = join(__dirname, '..', '..');
    const missing: string[] = [];

    for (const file of walk(srcRoot)) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!HTTP_DECORATOR.test(line)) return;

        let classIndex = -1;
        for (let i = index; i >= 0; i -= 1) {
          if (/^\s*export class \w+/.test(lines[i])) {
            classIndex = i;
            break;
          }
        }
        if (classIndex < 0) return;

        const classDecoratorBlock = lines
          .slice(Math.max(0, classIndex - 12), classIndex + 1)
          .join('\n');

        const decoratorBlock = lines
          .slice(Math.max(0, index - 12), Math.min(lines.length, index + 12))
          .join('\n');
        if (!classDecoratorBlock.includes('PermissionsGuard') && !decoratorBlock.includes('PermissionsGuard')) {
          return;
        }

        if (!decoratorBlock.includes('@RequirePermissions') && !decoratorBlock.includes('@AuthOnly')) {
          missing.push(`${file.replace(srcRoot, 'src')}:${index + 1} ${line.trim()}`);
        }
      });
    }

    expect(missing).toEqual([]);
  });
});
