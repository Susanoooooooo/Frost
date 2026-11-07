/**
 * «Микс дня»: подборка по тому, что человек слушает чаще всего, плюс похожие треки.
 * Всё считается на устройстве по журналу прослушиваний и избранному: никаких аккаунтов.
 * Микс стабилен в течение дня (детерминированный генератор от даты) и меняется в полночь;
 * кнопка «Обновить» собирает другой вариант.
 */
import { api } from './api';
import { loadJournal, type JournalEntry } from './journal';
import type { Track } from './types';
import { trackKey } from './types';

const DAY = 86_400_000;
const STORAGE_KEY = 'frost.dailyMix';
/** За сколько дней смотрим журнал. */
const WINDOW_DAYS = 30;
/** Сколько похожих подборок берём за основу. */
const SEED_COUNT = 3;
const MIX_SIZE = 30;
/** Не больше стольких треков одного исполнителя в миксе. */
const PER_ARTIST = 3;
/** Только что игравшее в микс не берём, чтобы он не повторял историю. */
const FRESH_HOURS = 36;

export interface DailyMix {
  /** Локальная дата ГГГГ-ММ-ДД, для которой собран микс. */
  day: string;
  tracks: Track[];
  /** Исполнители, от которых строился микс (для подписи). */
  seeds: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Локальная дата: микс меняется в полночь по часам пользователя. */
export function dayStamp(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Детерминированный генератор (mulberry32) от строки: один и тот же день даёт один и тот же микс. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const norm = (s: string | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Один и тот же трек из разных источников (YouTube и SoundCloud) считаем повтором. */
const songKey = (t: Track) => `${norm(t.artist)}|${norm(t.title)}`;
const artistKey = (t: Track) => norm(t.artist) || trackKey(t);
const canSeed = (t: Track) => t.streamable && (t.provider === 'youtube' || t.provider === 'soundcloud');

export interface SeedInput {
  entries: JournalEntry[];
  tracks: Record<string, Track>;
  liked: Track[];
  now: number;
}

/**
 * Оценка треков-кандидатов в «зёрна»: секунды прослушивания за окно с затуханием
 * по давности (вчерашнее весит больше, чем месячной давности) плюс бонус избранному.
 */
export function scoreSeeds({ entries, tracks, liked, now }: SeedInput): { track: Track; score: number }[] {
  const scores = new Map<string, number>();
  const from = now - WINDOW_DAYS * DAY;
  for (const [key, at, seconds] of entries) {
    if (at < from || at > now + DAY || !(seconds > 0)) continue;
    const ageDays = (now - at) / DAY;
    const weight = Math.exp(-Math.max(0, ageDays) / 10);
    scores.set(key, (scores.get(key) ?? 0) + Math.min(seconds, 900) * weight);
  }
  const byKey = new Map<string, Track>();
  for (const [key, track] of Object.entries(tracks)) byKey.set(key, track);
  for (const t of liked) {
    const key = trackKey(t);
    byKey.set(key, byKey.get(key) ?? t);
    scores.set(key, (scores.get(key) ?? 0) + 240);
  }
  const out: { track: Track; score: number }[] = [];
  for (const [key, score] of scores) {
    const track = byKey.get(key);
    if (track && canSeed(track)) out.push({ track, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Зёрна микса: из лучших кандидатов, разные исполнители, с перемешиванием на день. */
export function pickSeeds(scored: { track: Track; score: number }[], rand: () => number, count = SEED_COUNT): Track[] {
  const pool: { track: Track; score: number }[] = [];
  const artists = new Set<string>();
  for (const c of scored) {
    const a = artistKey(c.track);
    if (artists.has(a)) continue;
    artists.add(a);
    pool.push(c);
    if (pool.length >= 12) break;
  }
  return pool
    .map((c, i) => ({ track: c.track, w: (1 / (i + 1)) * (0.35 + rand()) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, count)
    .map((c) => c.track);
}

export interface AssembleInput {
  /** Похожие треки для каждого зерна. */
  groups: Track[][];
  /** Избранное: немного знакомого между новым. */
  favorites: Track[];
  /** Ключи треков, игравших в последние часы: их пропускаем. */
  recent: Set<string>;
  rand: () => number;
  limit?: number;
}

/** Сборка: по очереди из каждой подборки, без повторов, не больше PER_ARTIST на исполнителя. */
export function assembleMix({ groups, favorites, recent, rand, limit = MIX_SIZE }: AssembleInput): Track[] {
  const seen = new Set<string>();
  const perArtist = new Map<string, number>();
  const out: Track[] = [];
  const take = (t: Track): boolean => {
    if (!t.streamable) return false;
    const key = trackKey(t);
    const song = songKey(t);
    if (seen.has(key) || seen.has(song) || recent.has(key)) return false;
    const a = artistKey(t);
    if ((perArtist.get(a) ?? 0) >= PER_ARTIST) return false;
    seen.add(key);
    seen.add(song);
    perArtist.set(a, (perArtist.get(a) ?? 0) + 1);
    out.push(t);
    return true;
  };
  const shuffledFavs = favorites
    .map((t) => ({ t, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.t);
  const queues = groups.map((g) => g.slice());
  let favIndex = 0;
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length && !take(q.shift() as Track)) {
        // пропускаем повторы и недоступное
      }
      if (out.length >= limit) break;
    }
    // Каждый пятый трек: из избранного
    if (out.length % 5 === 4) {
      while (favIndex < shuffledFavs.length && !take(shuffledFavs[favIndex++])) {
        // ищем подходящий
      }
    }
  }
  return out.slice(0, limit);
}

export function parseDailyMix(raw: string | null): DailyMix | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DailyMix>;
    if (typeof v.day !== 'string' || !Array.isArray(v.tracks) || !Array.isArray(v.seeds)) return null;
    const tracks = v.tracks.filter((t): t is Track => !!t && typeof t === 'object' && typeof (t as Track).id === 'string');
    return { day: v.day, tracks, seeds: v.seeds.filter((s): s is string => typeof s === 'string') };
  } catch {
    return null;
  }
}

export function readDailyMix(): DailyMix | null {
  try {
    return parseDailyMix(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveDailyMix(mix: DailyMix) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mix));
  } catch {
    // нет места: микс просто соберётся заново
  }
}

/**
 * Собирает микс дня. `salt` меняет вариант (кнопка «Обновить»).
 * Возвращает null, если слушали слишком мало, чтобы было из чего собирать.
 */
export async function buildDailyMix(opts: { liked: Track[]; recentTracks: Track[]; salt?: string; now?: number }): Promise<DailyMix | null> {
  const now = opts.now ?? Date.now();
  const day = dayStamp(now);
  const rand = seededRandom(`${day}:${opts.salt ?? ''}`);
  const journal = await loadJournal(now - WINDOW_DAYS * DAY).catch(() => ({ entries: [] as JournalEntry[], tracks: {} as Record<string, Track> }));
  let seeds = pickSeeds(scoreSeeds({ entries: journal.entries, tracks: journal.tracks, liked: opts.liked, now }), rand);
  if (!seeds.length) seeds = pickSeeds(opts.recentTracks.filter(canSeed).map((track, i) => ({ track, score: 100 - i })), rand);
  if (!seeds.length) return null;

  const settled = await Promise.allSettled(seeds.map((s) => api.related(s.provider, s.id, s)));
  const groups = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const recent = new Set<string>();
  for (const [key, at] of journal.entries) if (now - at < FRESH_HOURS * 3_600_000) recent.add(key);
  // Сами зёрна в микс не кладём: их и так недавно слушали
  for (const s of seeds) recent.add(trackKey(s));
  const tracks = assembleMix({ groups, favorites: opts.liked.filter(canSeed), recent, rand });
  if (tracks.length < 5) return null;
  const mix: DailyMix = { day, tracks, seeds: [...new Set(seeds.map((s) => s.artist).filter(Boolean))] };
  saveDailyMix(mix);
  return mix;
}
