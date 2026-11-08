// Текст релиза на GitHub: раздел CHANGELOG.md для версии из src-tauri/tauri.conf.json
// и короткая инструкция по установке. Вызывается из .github/workflows/release.yml.
// Запуск вручную: node scripts/release-notes.mjs [версия]
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Раздел «## <версия> …» до следующего заголовка второго уровня, без самого заголовка. */
export function changelogSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const head = new RegExp(`^##\\s+v?${escaped}(?![\\w.-])`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  return body || null;
}

/** Полный текст релиза: что нового и как установить. */
export function releaseBody(section, version) {
  return [
    `## Что нового в Frost ${version}`,
    '',
    section,
    '',
    '## Установка',
    '',
    '- **Windows 10 и 11 (x64):** файл `Frost_*_x64-setup.exe` ниже. Установщик не подписан, поэтому SmartScreen может показать предупреждение: «Подробнее» → «Выполнить в любом случае».',
    '- **Android 8.0 и новее (arm64 и armv7):** файл `Frost_*_android.apk` ниже. Откройте его на телефоне и разрешите установку из этого источника. Обновления ставятся поверх, данные сохраняются. Подробнее: docs/ANDROID.md.',
    '- Рядом с каждым файлом лежит `.sha256`: Frost сверяет контрольную сумму сам, когда обновляется из настроек.',
    '',
  ].join('\n');
}

function main() {
  const version = process.argv[2] ?? JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')).version;
  const section = changelogSection(readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'), version);
  if (!section) {
    const msg = `В CHANGELOG.md нет раздела «## ${version}». Допишите, что нового, и запустите выпуск снова.`;
    console.error(process.env.GITHUB_ACTIONS ? `::error title=CHANGELOG::${msg}` : `ОШИБКА: ${msg}`);
    process.exit(1);
  }
  process.stdout.write(releaseBody(section, version));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
