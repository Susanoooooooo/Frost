/**
 * Резервная копия библиотеки: избранное, плейлисты, подписки, история, журнал и настройки.
 * Используется кнопками в настройках и автокопией по расписанию (useAutoBackup).
 */
import { invoke } from '@tauri-apps/api/core';
import { useLibrary } from '../store/library';
import { useSettings } from '../store/settings';
import { saveDocument } from './android';
import { exportJournal, importJournal } from './journal';
import { IS_ANDROID } from './platform';
import { APP_VERSION } from './version';
import { AUTO_BACKUP_KEEP, DEVICE_KEYS, SECRET_KEYS, backupFileName, settingsPatch, type Backup } from './backupFormat';

export { AUTO_BACKUP_KEEP, backupFileName, isBackupDue, parseBackup, type Backup, type BackupEvery } from './backupFormat';

function plainState(state: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'));
}

export async function buildBackup(): Promise<Backup> {
  const settings = plainState(useSettings.getState());
  for (const k of [...SECRET_KEYS, ...DEVICE_KEYS]) delete settings[k];
  return {
    app: 'frost',
    version: APP_VERSION,
    created: new Date().toISOString(),
    settings,
    library: plainState(useLibrary.getState()),
    journal: await exportJournal(),
  };
}

/** Восстанавливает копию. Возвращает дату копии и число добавленных записей журнала. */
export async function applyBackup(data: Backup): Promise<{ created: string; added: number }> {
  useSettings.getState().update(settingsPatch(data.settings, useSettings.getState() as unknown as Record<string, unknown>));
  const lib = useLibrary.getState() as unknown as Record<string, unknown>;
  const libPatch = Object.fromEntries(
    Object.entries(data.library).filter(([k, v]) => k in lib && typeof lib[k] !== 'function' && Array.isArray(lib[k]) === Array.isArray(v)),
  );
  useLibrary.setState(libPatch);
  const added = await importJournal(data.journal as never);
  return { created: data.created ?? '', added };
}

/**
 * Сохранить копию с выбором места: на Android системный диалог документа,
 * на Windows диалог сохранения. Возвращает false, если пользователь отменил.
 */
export async function exportBackup(): Promise<boolean> {
  const backup = await buildBackup();
  const fileName = backupFileName();
  if (IS_ANDROID) {
    // Диалог Android отдаёт не путь, а адрес документа: записывает сам плагин
    if (!(await saveDocument(fileName, JSON.stringify(backup)))) return false;
  } else {
    const { save: pick } = await import('@tauri-apps/plugin-dialog');
    const path = await pick({
      title: 'Резервная копия Frost',
      defaultPath: fileName,
      filters: [{ name: 'Резервная копия', extensions: ['json'] }],
    });
    if (!path) return false;
    await invoke('backup_write', { path, contents: JSON.stringify(backup) });
  }
  useSettings.getState().update({ lastBackupAt: Date.now() });
  return true;
}

/** Автокопия в папку (Windows): файл с датой, старые сверх AUTO_BACKUP_KEEP удаляются. */
export async function writeAutoBackup(dir: string): Promise<string> {
  const backup = await buildBackup();
  const path = await invoke<string>('backup_auto', {
    dir,
    name: backupFileName(new Date(), true),
    contents: JSON.stringify(backup),
    keep: AUTO_BACKUP_KEEP,
  });
  useSettings.getState().update({ lastBackupAt: Date.now() });
  return path;
}

/** Выбор папки для автокопий (Windows). */
export async function pickBackupFolder(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const dir = await open({ title: 'Папка для резервных копий Frost', directory: true, multiple: false });
  return typeof dir === 'string' ? dir : null;
}
