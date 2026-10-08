import { useId, useMemo, useState, type ReactNode } from 'react';
import { AdminIcon } from '@/components/icons/AdminIcon';

/**
 * Inputs that do the typing for you.
 *
 * Every one of these replaces a bare text box that an admin had to fill in
 * from memory, in a format nothing checked. A price was a row of digits with
 * no grouping, so 180000 and 1800000 looked alike; an age range was free text,
 * so "4-8 tuổi", "4–8 tuổi" and "từ 4 đến 8" all ended up in the same column
 * and the shop filter saw three different values.
 *
 * None of them take choice away: the field underneath is still editable, and a
 * value outside the suggestions is still accepted. They just mean the common
 * case is one click.
 */

/* ── Suggestion chips ──────────────────────────────────────────────────── */

export function PresetChips<T extends string | number>({
  options,
  value,
  onPick,
  format,
}: {
  options: readonly T[];
  /** The field's current value, so the matching chip can show as chosen. */
  value: string;
  onPick: (next: string) => void;
  /** Label for a chip, when it should read differently from its value. */
  format?: (option: T) => ReactNode;
}) {
  return (
    <div className="preset-chips">
      {options.map((option) => {
        const raw = String(option);
        return (
          <button
            key={raw}
            type="button"
            className={`preset-chip${value.trim() === raw ? ' active' : ''}`}
            onClick={() => onPick(raw)}
          >
            {format ? format(option) : raw}
          </button>
        );
      })}
    </div>
  );
}

/* ── Money ─────────────────────────────────────────────────────────────── */

const groups = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Money, grouped as you type.
 *
 * The value handed back is still plain digits, so nothing downstream has to
 * know about the formatting. Typing is unrestricted apart from dropping
 * everything that is not a digit — a price field that fights the keyboard is
 * worse than one that is hard to read.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  suggestions,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Round numbers worth one click, in đồng. */
  suggestions?: readonly number[];
  id?: string;
}) {
  const digits = String(value ?? '').replace(/\D/g, '');

  return (
    <>
      <div className="money-input">
        <input
          id={id}
          className="form-input"
          inputMode="numeric"
          placeholder={placeholder}
          value={digits ? groups(digits) : ''}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        />
        <span className="money-suffix">đ</span>
      </div>

      {suggestions && suggestions.length > 0 && (
        <PresetChips
          options={suggestions}
          value={digits}
          onPick={onChange}
          format={(n) => (n === 0 ? 'Miễn phí' : `${groups(String(n))}đ`)}
        />
      )}
    </>
  );
}

/** The same grouping, for read-only places. */
export function formatDong(value: number | string) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? `${groups(digits)}đ` : '0đ';
}

/* ── Pick one, or type your own ────────────────────────────────────────── */

/**
 * A text field backed by the values already in use.
 *
 * Collections are the case this was built for: they only group products if
 * everyone spells them the same way, and a free text box guarantees that
 * sooner or later somebody will not. The list is what the catalogue actually
 * contains, so picking from it is the path of least resistance, and a genuinely
 * new name is still just typing.
 */
export function ComboField({
  value,
  onChange,
  options,
  placeholder,
  emptyHint,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; count?: number }>;
  placeholder?: string;
  /** Shown instead of the list when there is nothing to pick from yet. */
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  const matches = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.value.toLowerCase().includes(term));
  }, [options, value]);

  const exact = options.some((o) => o.value.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="combo-field">
      <div className="combo-input">
        <input
          className="form-input"
          placeholder={placeholder}
          value={value}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A click on an option would otherwise be lost to the blur that
          // closes the list before it lands.
          onBlur={() => setTimeout(() => setOpen(false), 140)}
        />
        <button
          type="button"
          className="combo-toggle"
          aria-label={open ? 'Đóng danh sách' : 'Xem danh sách có sẵn'}
          onClick={() => setOpen((v) => !v)}
        >
          <AdminIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </div>

      {open && (
        <ul className="combo-list" id={listId} role="listbox">
          {matches.length === 0 && (
            <li className="combo-empty">
              {options.length === 0
                ? emptyHint || 'Chưa có nhóm nào — gõ để tạo nhóm đầu tiên.'
                : 'Không có nhóm nào khớp. Gõ xong là tạo nhóm mới.'}
            </li>
          )}

          {matches.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`combo-option${option.value === value ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.value}</span>
                {option.count !== undefined && (
                  <em>{option.count} sản phẩm</em>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.trim() && !exact && options.length > 0 && (
        <span className="field-hint combo-new">
          <AdminIcon name="plus" size={13} /> “{value.trim()}” là nhóm mới
        </span>
      )}
    </div>
  );
}

/* ── The shared vocabularies ───────────────────────────────────────────── */

/**
 * Age bands, written one way.
 *
 * The en dash matters: the shop groups by this string, so "4-8 tuổi" with a
 * hyphen is a different band from "4–8 tuổi" with a dash, and both will sit in
 * the filter list looking like a duplicate.
 */
export const AGE_PRESETS = [
  '3–5 tuổi',
  '4–8 tuổi',
  '5–9 tuổi',
  '6–10 tuổi',
  '7–12 tuổi',
  '3–11 tuổi',
] as const;

/** Room sizes Sprouty actually runs. */
export const CAPACITY_PRESETS = [8, 10, 12, 16, 20, 24, 30] as const;

/** Workshop fees, and free. */
export const WORKSHOP_PRICE_PRESETS = [0, 120000, 160000, 180000, 220000, 280000] as const;

/** Kit prices, around the ones already in the catalogue. */
export const PRODUCT_PRICE_PRESETS = [120000, 160000, 180000, 220000, 290000, 350000] as const;

/** What a Smart build usually adds on top. */
export const SMART_DELTA_PRESETS = [50000, 80000, 100000, 150000] as const;
