import { describe, expect, test } from 'bun:test';
import { shuffledAvoiding } from '../src/lib/format';

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
