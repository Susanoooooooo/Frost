import { useEffect } from 'react';
import { exportBackup, isBackupDue, writeAutoBackup } from '../lib/backup';
import { IS_ANDROID } from '../lib/platform';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';

const HOUR = 3_600_000;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Автокопия по расписанию. Windows: молча сохраняет файл в выбранную папку
 * (удобно указать папку облачного диска). Android: папки без системного диалога нет,
 * поэтому Frost напоминает сохранить копию и открывает диалог по кнопке.
 */
export function useAutoBackup() {
  useEffect(() => {
    let busy = false;
    let failedAt = 0;
    const check = async () => {
      const s = useSettings.getState();
      if (busy || s.autoBackup === 'off') return;
      const now = Date.now();
      if (IS_ANDROID) {
        if (!isBackupDue(s.autoBackup, Math.max(s.lastBackupAt, s.backupRemindedAt), now)) return;
        s.update({ backupRemindedAt: now });
        toast('Пора сохранить резервную копию библиотеки', 'info', {
          label: 'Сохранить',
          onClick: () =>
            void exportBackup()
              .then((ok) => ok && toast('Резервная копия сохранена', 'success'))
              .catch((e) => toast(`Не удалось сохранить копию: ${errText(e)}`, 'error')),
        });
        return;
      }
      if (!s.autoBackupDir || !isBackupDue(s.autoBackup, s.lastBackupAt, now)) return;
      // После ошибки (например, отключён внешний диск) пробуем не чаще раза в 6 часов
      if (failedAt && now - failedAt < 6 * HOUR) return;
      busy = true;
      try {
        await writeAutoBackup(s.autoBackupDir);
        failedAt = 0;
      } catch (e) {
        failedAt = now;
        toast(`Автокопия не сохранилась: ${errText(e)}`, 'error');
      } finally {
        busy = false;
      }
    };
    const first = window.setTimeout(() => void check(), 30_000);
    const timer = window.setInterval(() => void check(), HOUR);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
}
