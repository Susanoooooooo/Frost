import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('релиз: единая версия', () => {
  const pkg = JSON.parse(read('package.json')) as { version: string };
  const lock = JSON.parse(read('package-lock.json')) as { version: string; packages: Record<string, { version?: string }> };
  const conf = JSON.parse(read('src-tauri/tauri.conf.json')) as { version: string };
  const cargo = read('src-tauri/Cargo.toml').match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const cargoLock = read('src-tauri/Cargo.lock').match(/\[\[package\]\]\r?\nname = "frost"\r?\nversion = "([^"]+)"/)?.[1];

  test('package.json, package-lock.json, tauri.conf.json, Cargo.toml и Cargo.lock совпадают', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[''].version).toBe(pkg.version);
    expect(conf.version).toBe(pkg.version);
    expect(cargo).toBe(pkg.version);
    expect(cargoLock).toBe(pkg.version);
  });

  test('в CHANGELOG.md есть раздел этой версии', () => {
    expect(read('CHANGELOG.md')).toMatch(new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')}\\b`, 'm'));
  });
});

describe('Android: плагин frost-mobile', () => {
  const kt = read('src-tauri/plugins/frost-mobile/android/src/main/java/app/frost/mobile/FrostMobilePlugin.kt');

  test('@TauriPlugin с разрешениями стоит прямо над классом плагина', () => {
    // Tauri читает разрешения (audio, storage) с аннотации класса плагина.
    // Если между ними окажется другой класс, запрос доступа к музыке перестанет работать.
    const block = kt.match(/@TauriPlugin\(([\s\S]*?)\n\)\s*\n(?:\/\/[^\n]*\n)*\s*class (\w+)/);
    expect(block?.[2]).toBe('FrostMobilePlugin');
    expect(block?.[1]).toContain('alias = "audio"');
    expect(block?.[1]).toContain('alias = "storage"');
  });
});
