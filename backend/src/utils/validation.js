import { z } from 'zod';
import { AppError } from './errors.js';

export const noHtml = (label) => z.string().refine(
  s => !/[<>]/.test(s),
  { message: `${label} không được chứa ký tự < hoặc >.` }
);

export function parseOrThrow(schema, data) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
  }
  return parsed.data;
}

export function intParam(value, label = 'ID') {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(`${label} không hợp lệ.`, 400);
  return n;
}

export function boolValue(value) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return false;
}

export async function multipartFields(req) {
  const file = await req.file();
  if (!file) return { file: null, fields: {} };
  const fields = {};
  for (const [key, value] of Object.entries(file.fields || {})) {
    if (key === file.fieldname) continue;
    fields[key] = value?.value ?? value;
  }
  return { file, fields };
}
