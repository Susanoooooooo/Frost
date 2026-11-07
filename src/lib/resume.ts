/**
 * «Продолжить с места остановки»: трек и позиция, на которых остановилось воспроизведение.
 * Хранится отдельно от состояния плеера (одна маленькая запись), чтобы не переписывать
 * всю сохранённую очередь каждые несколько секунд.
 */

const STORAGE_KEY = 'frost.resume';
/** Ближе к началу продолжать нет смысла: трек просто начнётся заново. */
const MIN_POSITION = 10;
/** У самого конца тоже начинаем заново, иначе трек сразу закончится. */
const END_MARGIN = 15;

export interface ResumePoint {
  /** trackKey трека. */
  key: string;
  /** Позиция в секундах. */
  at: number;
}

export function parseResume(raw: string | null): ResumePoint | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ResumePoint>;
    if (typeof v.key !== 'string' || !v.key || typeof v.at !== 'number' || !Number.isFinite(v.at)) return null;
    return { key: v.key, at: Math.max(0, v.at) };
  } catch {
    return null;
  }
}

/** С какой секунды начать трек `key` длиной `duration` (0: с начала). */
export function resumeStart(point: ResumePoint | null, key: string, duration: number): number {
  if (!point || point.key !== key || point.at < MIN_POSITION) return 0;
  if (duration > 0 && point.at > duration - END_MARGIN) return 0;
  return Math.floor(point.at);
}

export function readResume(): ResumePoint | null {
  try {
    return parseResume(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveResume(key: string, at: number): void {
  if (!key || !Number.isFinite(at)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, at: Math.round(at * 10) / 10 }));
  } catch {
    // Хранилище переполнено или недоступно: просто начнём трек сначала
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
