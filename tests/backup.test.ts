import { describe, expect, test } from 'bun:test';
import { backupFileName, isBackupDue, parseBackup, settingsPatch } from '../src/lib/backupFormat';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 7, 23, 30).getTime();

describe('резервная копия: расписание', () => {
  test('выключено: никогда', () => {
    expect(isBackupDue('off', 0, NOW)).toBe(false);
  });
  test('ни разу не сохраняли: пора', () => {
    expect(isBackupDue('weekly', 0, NOW)).toBe(true);
  });
  test('периоды с допуском в час', () => {
    expect(isBackupDue('daily', NOW - DAY + 30 * 60_000, NOW)).toBe(true);
    expect(isBackupDue('daily', NOW - 10 * 3_600_000, NOW)).toBe(false);
    expect(isBackupDue('weekly', NOW - 6 * DAY, NOW)).toBe(false);
    expect(isBackupDue('weekly', NOW - 7 * DAY, NOW)).toBe(true);
    expect(isBackupDue('monthly', NOW - 29 * DAY, NOW)).toBe(false);
    expect(isBackupDue('monthly', NOW - 30 * DAY, NOW)).toBe(true);
  });
  test('время «из будущего» (переведённые часы) не блокирует копию', () => {
    expect(isBackupDue('daily', NOW + DAY, NOW)).toBe(true);
  });
});

describe('резервная копия: файл', () => {
  test('имя с локальной датой', () => {
    const d = new Date(2026, 0, 5, 23, 59);
    expect(backupFileName(d)).toBe('frost-backup-2026-01-05.json');
    expect(backupFileName(d, true)).toBe('frost-autobackup-2026-01-05.json');
  });

  test('разбор: только копии Frost', () => {
    expect(() => parseBackup('не json')).toThrow('повреждён');
    expect(() => parseBackup('{"app":"other","settings":{},"library":{}}')).toThrow('не резервная копия');
    expect(() => parseBackup('null')).toThrow('не резервная копия');
    expect(parseBackup('{"app":"frost","version":"1.0.0","created":"x","settings":{},"library":{}}').version).toBe('1.0.0');
  });

  test('восстанавливаются только известные настройки того же типа, без токенов и служебных полей', () => {
    const current = { volume: 0.5, crossfade: 6, theme: 'dark', lastBackupAt: 5, lastfmSession: '', update: () => {} };
    const saved = { volume: 0.8, crossfade: 'много', theme: 'light', lastBackupAt: 999, lastfmSession: 'secret', unknown: 1, update: 'x' };
    expect(settingsPatch(saved, current)).toEqual({ volume: 0.8, theme: 'light' });
  });
});
