const VIETINBANK_CODES = new Set(['ICB', 'VIETINBANK', '970415']);
const MEMO_RE = /SPROUTY([A-Z0-9]{6,16})/i;

export function paymentMemo(bank, id, workshop = false) {
  const reference = `SPROUTY${workshop ? 'WS' : ''}${id.slice(-8).toUpperCase()}`;
  // VietinBank API Banking only reports transfers starting with SEVQR.
  return VIETINBANK_CODES.has(String(bank).trim().toUpperCase())
    ? `SEVQR ${reference}`
    : reference;
}

export function paymentSuffix(code, content) {
  // SePay may return a full reference, an extracted suffix, or no code.
  const reference = String(content || '').match(MEMO_RE)
    || String(code || '').match(MEMO_RE);
  return reference ? reference[1] : String(code || '').trim();
}
