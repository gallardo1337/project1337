import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatSlices, donutSegment } from '../lib/actorStatChart.mjs';

test('top-five chart retains the full denominator through a remaining segment', () => {
  const items=[40,20,10,8,7,5,4,3,2,1].map((count,index)=>({value:`Value ${index}`,count}));
  const {total,slices}=buildStatSlices(items);
  assert.equal(total,100);
  assert.equal(slices.length,6);
  assert.equal(slices.at(-1).count,15);
  assert.equal(slices[0].percent,40);
  assert.equal(slices.reduce((sum,slice)=>sum+slice.percent,0),100);
  assert.ok(Math.abs(slices.at(-1).end-270)<1e-9);
});
test('empty and single-value categories never produce invalid geometry', () => {
  assert.deepEqual(buildStatSlices([]),{total:0,slices:[]});
  assert.equal(buildStatSlices([{value:'zero',count:0},{value:'invalid',count:NaN}]).total,0);
  const {slices}=buildStatSlices([{value:'4K',count:12}]);
  assert.equal(slices[0].percent,100);
  const path=donutSegment(slices[0].start,slices[0].end);
  assert.equal((path.match(/ A /g)||[]).length,4);
  assert.doesNotMatch(path,/NaN|Infinity/);
});
test('fractions use counts rather than rounded percentages and do not mutate inputs', () => {
  const items=[{value:'A',count:1,percent:33},{value:'B',count:2,percent:67}];
  const {slices}=buildStatSlices(items);
  assert.ok(Math.abs(slices[0].percent-100/3)<1e-10);
  assert.equal(items[0].percent,33);
  assert.equal(slices[0].end,slices[1].start);
});
