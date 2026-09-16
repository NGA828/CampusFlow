import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowLayout } from '../src/lib/responsive.ts';

test('cards stack in narrow containers and at large font scales', () => {
  assert.equal(rowLayout(256, 1, 140, 8, 3).columns, 1);
  assert.equal(rowLayout(320, 1, 140, 8, 3).columns, 2);
  assert.equal(rowLayout(320, 2, 140, 8, 3).columns, 1);
  assert.equal(rowLayout(688, 1, 140, 8, 3).columns, 3);
  assert.equal(rowLayout(688, 2, 140, 8, 3).columns, 2);
});
test('all widths, rotations and text scales fit without clipping', () => {
  for (const width of [0, 200, 256, 288, 320, 358, 398, 568, 688, 812, 1024]) {
    for (const fontScale of [1, 1.3, 1.5, 2, 3]) {
      for (const count of [1, 2, 3, 4]) {
        const { columns, itemWidth } = rowLayout(width, fontScale, 140, 8, count);
        assert.ok(columns >= 1 && columns <= count);
        assert.ok(itemWidth >= 0);
        assert.ok(Math.abs(columns * itemWidth + (columns - 1) * 8 - width) < 0.001);
        if (columns > 1) assert.ok(itemWidth >= 140 * fontScale);
      }
    }
  }
});
test('empty initial layout and invalid dimensions remain finite', () => {
  assert.deepEqual(rowLayout(0, 1, 140, 8, 0), { columns: 1, itemWidth: 0 });
  assert.deepEqual(rowLayout(Number.NaN), { columns: 1, itemWidth: 0 });
  assert.ok(Number.isFinite(rowLayout(320, Number.NaN).itemWidth));
});
