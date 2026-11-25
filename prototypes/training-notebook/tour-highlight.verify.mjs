import test from 'node:test';
import assert from 'node:assert/strict';
import { paddedHighlight } from './tour-highlight.mjs';
test('text clearance expands an annotation without mutating row geometry', () => {
  const row = {left:20,top:100,right:370,bottom:170};
  const text = {left:20,top:115,right:100,bottom:135};
  assert.deepEqual(paddedHighlight(row,[text],{width:390,height:844}),{left:10,top:100,right:370,bottom:170});
  assert.equal(row.left,20);
});
test('adequately padded bordered controls keep their existing bounds', () => {
  const row = {left:20,top:100,right:370,bottom:148};
  assert.deepEqual(paddedHighlight(row,[{left:36,top:114,right:190,bottom:132}],{width:390,height:844}),row);
});
test('headings gain clearance on all sides and remain inside the viewport', () => {
  assert.deepEqual(paddedHighlight({left:20,top:100,right:200,bottom:120},[{left:20,top:100,right:200,bottom:120}],{width:390,height:844}),{left:10,top:90,right:210,bottom:130});
});
