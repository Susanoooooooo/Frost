/**
 * Формат резервной копии и расписание автокопий: чистые функции без сторов и Tauri,
 * чтобы их можно было проверять тестами.
 */

const DAY = 86_400_000;

export interface Backup {
  app: 'frost';
  version: string;
  created: string;
  settings: Record<string, unknown>;
  library: Record<string, unknown>;
  journal?: unknown;
}

/** Токены сервисов в копию не попадают. */
export const SECRET_KEYS = ['listenbrainzToken', 'listenbrainzUser', 'lastfmSession', 'lastfmUser'];
/** Служебное состояние этого устройства: при восстановлении не переносим. */
export const DEVICE_KEYS = ['config', 'lastBackupAt', 'backupRemindedAt', 'lastSeenVersion'];

export type BackupEvery = 'off' | 'daily' | 'weekly' | 'monthly';
export const BACKUP_PERIODS: Record<Exclude<BackupEvery, 'off'>, number> = {
  daily: DAY,
  weekly: 7 * DAY,
  monthly: 30 * DAY,
};
/** Сколько автокопий хранить в папке. */
export const AUTO_BACKUP_KEEP = 10;

const pad = (n: number) => String(n).padStart(2, '0');

/** Имя файла с локальной датой (раньше бралась дата по UTC, и после полуночи имя «отставало»). */
export function backupFileName(now = new Date(), auto = false): string {
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${auto ? 'frost-autobackup' : 'frost-backup'}-${day}.json`;
}

/** Пора ли делать копию. Допуск в час, чтобы ежедневная копия не «уползала» по времени запуска. */
export function isBackupDue(every: BackupEvery, last: number, now: number): boolean {
  if (every === 'off') return false;
  if (!last || last > now) return true;
  return now - last >= BACKUP_PERIODS[every] - 3_600_000;
}

/** Проверяет, что это копия Frost, и возвращает её; иначе бросает понятную ошибку. */
export function parseBackup(text: string): Backup {
  let data: Partial<Backup>;
  try {
    data = JSON.parse(text) as Partial<Backup>;
  } catch {
    throw new Error('файл повреждён или это не JSON');
  }
  if (!data || data.app !== 'frost' || !data.settings || !data.library) throw new Error('это не резервная копия Frost');
  return data as Backup;
}

/** Только известные ключи с тем же типом значения: старые и чужие поля пропускаются. */
export function settingsPatch(saved: Record<string, unknown>, current: Record<string, unknown>): Record<string, unknown> {
  const skip = new Set([...SECRET_KEYS, ...DEVICE_KEYS]);
  return Object.fromEntries(
    Object.entries(saved).filter(([k, v]) => !skip.has(k) && k in current && typeof current[k] !== 'function' && typeof current[k] === typeof v),
  );
}
