import { describe, expect, test } from 'bun:test';
import { shuffledAvoiding } from '../src/lib/format';
import { parseResume, resumeStart } from '../src/lib/resume';
import { listenedDelta } from '../src/lib/scrobble';
import { shouldShowWhatsNew, WHATS_NEW } from '../src/lib/whatsNew';

describe('перемешивание нового круга', () => {
  test('новый круг не начинается с только что сыгравшего трека', () => {
    for (let run = 0; run < 200; run++) {
      const list = [1, 2, 3, 4, 5];
      const out = shuffledAvoiding(list, (x) => x === 3);
      expect(out[0]).not.toBe(3);
      expect([...out].sort()).toEqual(list);
    }
  });

  test('один трек или все «запрещённые» не ломают порядок', () => {
    expect(shuffledAvoiding([7], (x) => x === 7)).toEqual([7]);
    expect(shuffledAvoiding([1, 1], (x) => x === 1)).toEqual([1, 1]);
    expect(shuffledAvoiding([], () => true)).toEqual([]);
  });
});

describe('учёт прослушанного времени', () => {
  test('обычный тик: по сдвигу позиции', () => {
    expect(listenedDelta(1, 1.01)).toBeCloseTo(1);
  });

  test('редкий таймер в фоне: засчитывается всё проигранное, а не 2,5 с', () => {
    expect(listenedDelta(30, 30.2)).toBeCloseTo(30);
  });

  test('перемотка вперёд не считается прослушиванием', () => {
    expect(listenedDelta(120, 1)).toBeCloseTo(1.25);
  });

  test('позиция не двигалась или ушла назад: по часам, не больше 2,5 с', () => {
    expect(listenedDelta(0, 1)).toBe(1);
    expect(listenedDelta(-200, 1)).toBe(1);
    expect(listenedDelta(0, 60)).toBe(2.5);
    expect(listenedDelta(Number.NaN, -5)).toBe(0);
  });
});

describe('продолжение с места остановки', () => {
  test('разбор сохранённой точки', () => {
    expect(parseResume(null)).toBeNull();
    expect(parseResume('мусор')).toBeNull();
    expect(parseResume('{"key":"","at":5}')).toBeNull();
    expect(parseResume('{"key":"yt:1","at":"5"}')).toBeNull();
    expect(parseResume('{"key":"yt:1","at":-3}')).toEqual({ key: 'yt:1', at: 0 });
    expect(parseResume('{"key":"yt:1","at":83.4}')).toEqual({ key: 'yt:1', at: 83.4 });
  });

  test('продолжаем только тот же трек и не у краёв', () => {
    const p = { key: 'sc:42', at: 83.7 };
    expect(resumeStart(p, 'sc:42', 240)).toBe(83);
    expect(resumeStart(p, 'sc:43', 240)).toBe(0);
    expect(resumeStart({ key: 'sc:42', at: 4 }, 'sc:42', 240)).toBe(0);
    expect(resumeStart({ key: 'sc:42', at: 230 }, 'sc:42', 240)).toBe(0);
    expect(resumeStart(p, 'sc:42', 0)).toBe(83);
    expect(resumeStart(null, 'sc:42', 240)).toBe(0);
  });
});

describe('окно «Что нового»', () => {
  test('свежей установке не показываем', () => {
    expect(shouldShowWhatsNew('', '1.0.0', false, '1.0.0')).toBe(false);
  });
  test('после обновления с 0.9.x показываем один раз', () => {
    expect(shouldShowWhatsNew('', '1.0.0', true, '1.0.0')).toBe(true);
    expect(shouldShowWhatsNew('0.9.1', '1.0.0', true, '1.0.0')).toBe(true);
    expect(shouldShowWhatsNew('1.0.0', '1.0.0', true, '1.0.0')).toBe(false);
  });
  test('патч-версия без новых заметок: показываем, только если 1.0.0 ещё не видели', () => {
    expect(shouldShowWhatsNew('1.0.0', '1.0.1', true, '1.0.0')).toBe(false);
    expect(shouldShowWhatsNew('0.9.1', '1.0.1', true, '1.0.0')).toBe(true);
  });
  test('заметки о будущей версии не показываем', () => {
    expect(shouldShowWhatsNew('0.9.1', '0.9.2', true, '1.0.0')).toBe(false);
  });
  test('в заметках есть пункты с заголовком и текстом', () => {
    expect(WHATS_NEW.items.length).toBeGreaterThan(2);
    for (const item of WHATS_NEW.items) {
      expect(item.title.length).toBeGreaterThan(2);
      expect(item.text.length).toBeGreaterThan(10);
    }
  });
});
