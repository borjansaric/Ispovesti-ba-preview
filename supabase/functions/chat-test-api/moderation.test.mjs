import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyChatMessage} from './moderation.mjs';

test('normal emotional conversation is not flagged',()=>{
  assert.deepEqual(classifyChatMessage('Danas mi je baš teško i samo želim da me neko sasluša.'),[]);
});
test('direct threat is flagged for human review',()=>{
  assert.ok(classifyChatMessage('Ubiću te.').includes('possible_threat'));
});
test('obvious get-rich-quick promotion is flagged',()=>{
  assert.ok(classifyChatMessage('Garantovana zarada, uplati odmah!').includes('promotional_spam'));
});
test('phone-like number is flagged, not blocked',()=>{
  assert.ok(classifyChatMessage('Moj broj je +387 65 123 456').includes('possible_phone_number'));
});
test('long all-caps message is flagged',()=>{
  assert.ok(classifyChatMessage('OVO JE VEOMA DUGA PORUKA NAPISANA SKORO ISKLJUČIVO VELIKIM SLOVIMA').includes('excessive_caps'));
});
test('repeated phrase is flagged',()=>{
  assert.ok(classifyChatMessage('prodajem prodajem prodajem odmah').includes('repeated_phrase'));
});
test('short repeated affectionate phrase is not flagged',()=>{
  assert.deepEqual(classifyChatMessage('volim te volim te volim te'),[]);
});
