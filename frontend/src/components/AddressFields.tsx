import './AddressFields.css';

/**
 * A delivery address, one box per part.
 *
 * It was a single textarea, which asks the customer to remember the order the
 * parts go in and leaves nothing to check: "Quận 9" alone looks like a filled
 * field and no courier can act on it. Each part is asked for by name, so a
 * missing ward is a visibly empty box rather than something nobody notices
 * until the parcel comes back.
 *
 * Two levels, not three. Vietnam moved to a two-tier structure on 1 July
 * 2025 — province or city, then ward or commune — and the district level was
 * abolished along with it. A "Quận / Huyện" box would be asking for something
 * that no longer exists.
 *
 * The parts are joined into the one string the API stores. Separate columns
 * would be the better model, but that is a migration plus every screen that
 * shows an address; this gets the input right without pretending otherwise.
 */

export interface AddressParts {
  street: string;
  ward: string;
  province: string;
}

export const EMPTY_ADDRESS: AddressParts = { street: '', ward: '', province: '' };

/** The single line the API stores, in the order a Vietnamese address is read. */
export function joinAddress(parts: AddressParts) {
  return [parts.street, parts.ward, parts.province]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * The country, when somebody typed it.
 *
 * Left in, it is read as the province and shifts every other part down a
 * place: the real province lands in the ward box, and saving writes the
 * whole thing back one level out — which is how an address grows a second
 * copy of its own city on the end.
 */
const COUNTRY = /^(việt ?nam|vietnam|vn)$/i;

/** Written before the 2025 reform, these carry a level that no longer exists. */
const OLD_DISTRICT = /^(quận|huyện|thị xã|thị trấn|tp\.?|thành phố)\s/i;

/**
 * Best-effort split of a stored address back into boxes.
 *
 * Read from the end, because the tail is the predictable part: province, then
 * ward. Anything before that is the street, which is where the free-form part
 * belongs anyway.
 *
 * An address saved before July 2025 has a district sitting between the ward
 * and the province. It is kept on the street line rather than dropped — the
 * customer wrote it, and it may still be the clearest thing on the label —
 * but it is not given a box of its own, because that level is gone.
 */
export function splitAddress(value: string): AddressParts {
  const parts = (value || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  while (parts.length && COUNTRY.test(parts[parts.length - 1])) parts.pop();

  // Too few parts to divide with any confidence: put it all in the free-form
  // box rather than guessing which piece is which.
  if (parts.length < 3) return { ...EMPTY_ADDRESS, street: parts.join(', ') || value || '' };

  const province = parts.pop() as string;

  let district = '';
  if (parts.length >= 2 && OLD_DISTRICT.test(parts[parts.length - 1])) {
    district = parts.pop() as string;
  }

  const ward = (parts.pop() as string) || '';
  const street = [parts.join(', '), district].filter(Boolean).join(', ');

  return { street, ward, province };
}

export function AddressFields({
  value,
  onChange,
  required = true,
}: {
  value: AddressParts;
  onChange: (next: AddressParts) => void;
  required?: boolean;
}) {
  const set = (key: keyof AddressParts) => (next: string) => onChange({ ...value, [key]: next });
  const star = required ? ' *' : '';

  return (
    <div className="addr-fields">
      <div className="form-group addr-wide">
        <label className="form-label">Số nhà, tên đường{star}</label>
        <input
          className="form-input"
          autoComplete="address-line1"
          placeholder="Số nhà, tên đường, toà nhà…"
          value={value.street}
          onChange={(e) => set('street')(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Phường / Xã{star}</label>
        <input
          className="form-input"
          autoComplete="address-level2"
          placeholder="Phường hoặc xã"
          value={value.ward}
          onChange={(e) => set('ward')(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Tỉnh / Thành phố{star}</label>
        <input
          className="form-input"
          autoComplete="address-level1"
          placeholder="Tỉnh hoặc thành phố"
          value={value.province}
          onChange={(e) => set('province')(e.target.value)}
        />
      </div>
    </div>
  );
}

/** Which box is empty, so the message can name it instead of saying "thiếu". */
export function missingAddressField(parts: AddressParts): string | null {
  if (!parts.street.trim()) return 'Nhập số nhà và tên đường.';
  if (!parts.ward.trim()) return 'Nhập phường hoặc xã.';
  if (!parts.province.trim()) return 'Nhập tỉnh hoặc thành phố.';
  return null;
}
