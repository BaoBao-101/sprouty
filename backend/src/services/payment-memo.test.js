import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentMemo, paymentSuffix } from './payment-memo.js';

test('VietinBank instructions include the required prefix and preserve references', () => {
  for (const bank of ['ICB', 'VietinBank', '970415', ' icb ']) {
    assert.equal(paymentMemo(bank, 'order62eu5q0v'), 'SEVQR SPROUTY62EU5Q0V');
    assert.equal(paymentMemo(bank, 'booking62eu5q0v', true), 'SEVQR SPROUTYWS62EU5Q0V');
  }
  assert.equal(paymentMemo('VCB', 'order62eu5q0v'), 'SPROUTY62EU5Q0V');
});

test('new and existing transfer descriptions resolve to the same order', () => {
  for (const memo of ['SPROUTY62EU5Q0V', 'SEVQR SPROUTY62EU5Q0V']) {
    assert.equal(paymentSuffix(null, memo), '62EU5Q0V');
    assert.equal(paymentSuffix(memo, ''), '62EU5Q0V');
    assert.equal(paymentSuffix('62EU5Q0V', memo), '62EU5Q0V');
  }
  assert.equal(paymentSuffix(null, 'SEVQR SPROUTYWS62EU5Q0V'), 'WS62EU5Q0V');
  assert.equal(paymentSuffix('62EU5Q0V', ''), '62EU5Q0V');
  assert.equal(paymentSuffix(null, 'unrelated transfer'), '');
});
