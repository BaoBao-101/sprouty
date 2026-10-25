import { View } from 'react-native';
import { Field } from './ui';

/**
 * A delivery address, one box per part — street, ward, province — joined into
 * the single line the API stores. Two levels after the street, not three:
 * Vietnam abolished the district level on 1 July 2025. Same rules as the
 * website's components/AddressFields.tsx.
 */
export interface AddressParts {
  street: string;
  ward: string;
  province: string;
}

export const EMPTY_ADDRESS: AddressParts = { street: '', ward: '', province: '' };

export function joinAddress(parts: AddressParts) {
  return [parts.street, parts.ward, parts.province].map((p) => p.trim()).filter(Boolean).join(', ');
}

const COUNTRY = /^(việt ?nam|vietnam|vn)$/i;
const OLD_DISTRICT = /^(quận|huyện|thị xã|thị trấn|tp\.?|thành phố)\s/i;

/** Best-effort split of a stored address back into boxes, read from the end. */
export function splitAddress(value: string): AddressParts {
  const parts = (value || '').split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length && COUNTRY.test(parts[parts.length - 1])) parts.pop();
  if (parts.length < 3) return { ...EMPTY_ADDRESS, street: parts.join(', ') };
  const province = parts.pop() as string;
  let district = '';
  if (parts.length >= 2 && OLD_DISTRICT.test(parts[parts.length - 1])) district = parts.pop() as string;
  const ward = (parts.pop() as string) || '';
  return { street: [parts.join(', '), district].filter(Boolean).join(', '), ward, province };
}

/** Which box is empty, so the message can name it. */
export function missingAddressField(parts: AddressParts): string | null {
  if (!parts.street.trim()) return 'Nhập số nhà và tên đường.';
  if (!parts.ward.trim()) return 'Nhập phường hoặc xã.';
  if (!parts.province.trim()) return 'Nhập tỉnh hoặc thành phố.';
  return null;
}

export function AddressFields({ value, onChange, error }: { value: AddressParts; onChange: (next: AddressParts) => void; error?: string }) {
  const set = (key: keyof AddressParts) => (text: string) => onChange({ ...value, [key]: text });
  return (
    <View style={{ gap: 12 }}>
      <Field label="Số nhà, tên đường *" value={value.street} onChangeText={set('street')} placeholder="Số nhà, tên đường, toà nhà…" autoComplete="street-address" />
      <Field label="Phường / Xã *" value={value.ward} onChangeText={set('ward')} placeholder="Phường hoặc xã" />
      <Field label="Tỉnh / Thành phố *" value={value.province} onChangeText={set('province')} placeholder="Tỉnh hoặc thành phố" error={error} />
    </View>
  );
}
