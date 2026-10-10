import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const normalized = (text) => text.replaceAll('\r\n', '\n');
const inventory = [
  '# Dependency inventory',
  '',
  'Generated from package-lock.json. Includes runtime and development dependencies; optional platform packages may not be installed on this machine.',
  '',
  '| Package | Version | License | Use |',
  '| --- | --- | --- | --- |',
];
const notices = [
  'OS Lab Simulator — third-party runtime notices',
  'Generated from the committed lockfile and installed package license files.',
  'Development dependencies are listed separately in DEPENDENCIES.md.',
  '',
];
for (const [path, entry] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b, 'en'),
)) {
  if (!path) continue;
  const name = path.split('node_modules/').at(-1);
  inventory.push(
    `| ${name} | ${entry.version} | ${entry.license ?? 'See package notices'} | ${entry.dev ? 'Development' : 'Runtime dependency graph'} |`,
  );
  if (entry.dev) continue;
  const files = readdirSync(path, { recursive: true })
    .filter((file) =>
      /(^|[\\/])(licen[cs]e|copying|notice)(\.|$|-)/i.test(file),
    )
    .sort();
  if (!files.length) throw new Error(`Missing runtime license text: ${path}`);
  notices.push(
    `\n${'='.repeat(72)}\n${name}@${entry.version} (${entry.license ?? 'See below'})`,
  );
  if (name === 'victory-vendor') {
    notices.push(
      '\nUpstream MIT license: https://github.com/FormidableLabs/victory/blob/main/LICENSE.txt\n' +
        normalized(
          readFileSync('deployment/victory-LICENSE.txt', 'utf8'),
        ).trim(),
    );
  }
  for (const file of files)
    notices.push(
      `\n--- ${file.replaceAll('\\', '/')} ---\n${normalized(readFileSync(join(path, file), 'utf8')).trim()}`,
    );
}
const outputs = [
  ['DEPENDENCIES.md', inventory.join('\n') + '\n'],
  ['public/THIRD_PARTY_NOTICES.txt', notices.join('\n') + '\n'],
];
if (process.argv.includes('--check')) {
  for (const [path, content] of outputs) {
    if (normalized(readFileSync(path, 'utf8')) !== content)
      throw new Error(`${path} is stale. Run npm run licenses.`);
  }
  console.log(
    'Dependency inventory and runtime license notices match the lockfile.',
  );
} else {
  mkdirSync('public', { recursive: true });
  for (const [path, content] of outputs) writeFileSync(path, content);
  console.log(
    `Recorded ${inventory.length - 6} dependency entries and runtime license notices.`,
  );
}
