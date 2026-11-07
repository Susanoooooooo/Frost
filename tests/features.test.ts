import { describe, expect, test } from 'bun:test';
import { shuffledAvoiding } from '../src/lib/format';
import { listenedDelta } from '../src/lib/scrobble';

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
