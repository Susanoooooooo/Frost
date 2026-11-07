import { isNewer } from './version';

/** Один пункт окна «Что нового». */
export interface WhatsNewItem {
  title: string;
  text: string;
}

/**
 * Главное в последнем крупном выпуске. Показывается один раз после обновления.
 * Полный список изменений: CHANGELOG.md и описание релиза на GitHub.
 */
export const WHATS_NEW: { version: string; items: WhatsNewItem[] } = {
  version: '1.0.0',
  items: [
    {
      title: 'Микс дня',
      text: 'На главной: подборка из того, что вы слушаете чаще всего, и похожих треков. Обновляется раз в день.',
    },
    {
      title: 'Продолжение с места остановки',
      text: 'После перезапуска последний трек продолжится с той же секунды. Отключается в настройках воспроизведения.',
    },
    {
      title: 'Автоматические резервные копии',
      text: 'На Windows Frost сам сохраняет копию библиотеки в выбранную папку, на Android напоминает сохранить её.',
    },
    {
      title: 'Надёжные обновления',
      text: 'Скачанное обновление сверяется по SHA-256, а настройки сохраняются так, что сбой при записи их не испортит.',
    },
    {
      title: 'Исправления',
      text: 'Доступ к музыке на телефоне на Android, плавный переход на стыке кругов при перемешивании, точный учёт прослушиваний в фоне.',
    },
  ],
};

/**
 * Показывать ли окно после запуска версии `current`.
 * Свежей установке (обучение ещё не пройдено) окно не нужно; после обновления показываем,
 * если заметки описывают версию новее последней увиденной, но не новее текущей.
 */
export function shouldShowWhatsNew(lastSeen: string, current: string, onboarded: boolean, notesVersion = WHATS_NEW.version): boolean {
  if (!onboarded || !current || lastSeen === current) return false;
  if (isNewer(notesVersion, current)) return false;
  return !lastSeen || isNewer(notesVersion, lastSeen);
}
