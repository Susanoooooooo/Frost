import { describe, expect, test } from 'bun:test';
import { assembleMix, dayStamp, parseDailyMix, pickSeeds, scoreSeeds, seededRandom } from '../src/lib/dailyMix';
import type { JournalEntry } from '../src/lib/journal';
import type { Track } from '../src/lib/types';
import { trackKey } from '../src/lib/types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 7, 12);

function tr(id: string, artist: string, title = `Song ${id}`, provider: Track['provider'] = 'youtube'): Track {
  return { id, provider, title, artist, duration: 200, streamable: true } as Track;
}

describe('микс дня: генератор и даты', () => {
  test('один и тот же день даёт одну и ту же последовательность', () => {
    const a = seededRandom('2026-11-07');
    const b = seededRandom('2026-11-07');
    const c = seededRandom('2026-11-08');
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    for (const x of sa) expect(x >= 0 && x < 1).toBe(true);
  });

  test('дата в формате ГГГГ-ММ-ДД', () => {
    expect(dayStamp(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('микс дня: зёрна', () => {
  const a1 = tr('a1', 'Artist A');
  const a2 = tr('a2', 'Artist A');
  const b1 = tr('b1', 'Artist B');
  const c1 = tr('c1', 'Artist C');
  const local = tr('l1', 'Local', 'x', 'local');
  const tracks = Object.fromEntries([a1, a2, b1, c1, local].map((t) => [trackKey(t), t]));

  test('свежие прослушивания весят больше старых, избранное получает бонус', () => {
    const entries: JournalEntry[] = [
      [trackKey(a1), NOW - 1 * DAY, 600],
      [trackKey(b1), NOW - 25 * DAY, 600],
      [trackKey(local), NOW - DAY, 5000],
      [trackKey(c1), NOW - 40 * DAY, 9999],
    ];
    const scored = scoreSeeds({ entries, tracks, liked: [a2], now: NOW });
    const keys = scored.map((s) => trackKey(s.track));
    expect(keys[0]).toBe(trackKey(a1));
    expect(keys).toContain(trackKey(a2));
    expect(keys).not.toContain(trackKey(local)); // локальные файлы не годятся в зёрна
    expect(keys).not.toContain(trackKey(c1)); // за пределами 30 дней
  });

  test('зёрна от разных исполнителей', () => {
    const scored = [a1, a2, b1, c1].map((track, i) => ({ track, score: 100 - i }));
    const seeds = pickSeeds(scored, seededRandom('x'), 3);
    expect(seeds).toHaveLength(3);
    expect(new Set(seeds.map((s) => s.artist)).size).toBe(3);
  });
});

describe('микс дня: сборка', () => {
  test('без повторов, без недавнего, не больше 3 треков исполнителя, в пределах лимита', () => {
    const g1 = [tr('1', 'X'), tr('2', 'X'), tr('3', 'X'), tr('4', 'X'), tr('5', 'Y')];
    const g2 = [tr('1', 'X'), tr('6', 'Z'), tr('7', 'Z', 'Song 7'), tr('8', 'W')];
    const dupOtherSource = tr('sc8', 'W', 'Song 8', 'soundcloud');
    const blocked = { ...tr('9', 'Q'), streamable: false } as Track;
    const recent = new Set([trackKey(tr('6', 'Z'))]);
    const mix = assembleMix({ groups: [g1, [...g2, dupOtherSource, blocked]], favorites: [tr('f1', 'Fav')], recent, rand: seededRandom('s'), limit: 30 });
    const keys = mix.map(trackKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(trackKey(tr('6', 'Z')));
    expect(keys).not.toContain(trackKey(blocked));
    expect(keys).not.toContain(trackKey(dupOtherSource)); // тот же трек из другого источника
    expect(mix.filter((t) => t.artist === 'X').length).toBeLessThanOrEqual(3);
    expect(keys).toContain(trackKey(tr('f1', 'Fav')));
  });

  test('лимит соблюдается и подборки чередуются', () => {
    const g1 = Array.from({ length: 40 }, (_, i) => tr(`a${i}`, `A${i}`));
    const g2 = Array.from({ length: 40 }, (_, i) => tr(`b${i}`, `B${i}`));
    const mix = assembleMix({ groups: [g1, g2], favorites: [], recent: new Set(), rand: seededRandom('t'), limit: 10 });
    expect(mix).toHaveLength(10);
    expect(mix[0].id).toBe('a0');
    expect(mix[1].id).toBe('b0');
  });

  test('разбор сохранённого микса', () => {
    expect(parseDailyMix(null)).toBeNull();
    expect(parseDailyMix('{')).toBeNull();
    expect(parseDailyMix('{"day":"2026-11-07","tracks":[{"id":"1"},null,5],"seeds":["A",3]}')).toEqual({
      day: '2026-11-07',
      tracks: [{ id: '1' } as Track],
      seeds: ['A'],
    });
  });
});
