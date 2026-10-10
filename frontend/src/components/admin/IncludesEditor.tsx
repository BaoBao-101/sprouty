import { useRef, type KeyboardEvent } from 'react';
import { AdminIcon } from '@/components/icons/AdminIcon';

/**
 * "Gồm có": what the customer gets for their money.
 *
 * Stored as the product's `includes` and shown on the product page under
 * "📦 Bộ kit gồm có" as a ticked list. It was labelled "Trong hộp" with a
 * single blank box, which said neither what it was for nor where it would
 * appear — and Sprouty kits are simulated plants now, so there is no box. The
 * editor says both, offers the lines most products need as one-click
 * suggestions, and shows the list exactly as the customer will read it.
 */

const MAX_ITEMS = 40;
const MAX_LEN = 300;

/** The lines most products of a kind carry, so nobody types them from memory. */
function suggestionsFor(category: string, speciesLabel?: string): string[] {
  if (category === 'membership') {
    return [
      'Tối đa 25 lá kỷ niệm mỗi kit',
      'Plant Buddy AI không giới hạn lượt hỏi',
      '3 khung cảnh 3D: Đêm đầy sao, Nắng mùa thu, Xuân hoa anh đào',
      '3 mẫu chậu VIP: đất nung khắc vân, gốm men ngọc, sứ men lam',
      'Huy hiệu VIP trên tài khoản',
      'Ưu tiên hỗ trợ',
    ];
  }
  if (category === 'book') {
    return [
      'Sách hướng dẫn chăm cây cho bé',
      'Phiếu quan sát cây theo từng giai đoạn',
      'Bộ câu hỏi khám phá cùng ba mẹ',
      'Hình minh hoạ màu',
    ];
  }
  // Species labels already read "Cây đậu"; others are a bare name like "Ớt".
  const name = speciesLabel ? (/^cây\s/i.test(speciesLabel) ? speciesLabel : `Cây ${speciesLabel.toLowerCase()}`) : 'Cây';
  const plant = `${name} mô phỏng 3D (8 giai đoạn)`;
  return [
    plant,
    'Mã kích hoạt — gieo hạt ngay trên web',
    'Cảm biến độ ẩm đất & nhiệt độ',
    'Mở dần 8 thiết bị IoT ảo',
    'Plant Buddy AI hướng dẫn từng bước',
    'Video hướng dẫn chăm cây',
    'Album Cây Kỷ Niệm',
    'Chứng nhận khi thu hoạch',
  ];
}

export function IncludesEditor({
  items,
  onChange,
  category,
  speciesLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  category: string;
  speciesLabel?: string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const filled = items.map((i) => i.trim()).filter(Boolean);
  const lower = new Set(filled.map((i) => i.toLowerCase()));
  const suggestions = suggestionsFor(category, speciesLabel);
  const missing = suggestions.filter((s) => !lower.has(s.toLowerCase()));
  const heading = category === 'membership' ? '✨ Quyền lợi của gói' : category === 'book' ? '📘 Sách gồm có' : '📦 Bộ kit gồm có';

  const duplicates = new Set(
    filled.filter((item, i) => filled.findIndex((x) => x.toLowerCase() === item.toLowerCase()) !== i).map((i) => i.toLowerCase()),
  );

  const focus = (i: number) => requestAnimationFrame(() => inputs.current[i]?.focus());

  function setAt(i: number, value: string) {
    onChange(items.map((x, j) => (j === i ? value : x)));
  }

  function insertAfter(i: number, value = '') {
    if (items.length >= MAX_ITEMS) return;
    const next = [...items];
    next.splice(i + 1, 0, value);
    onChange(next);
    focus(i + 1);
  }

  function remove(i: number) {
    const next = items.filter((_, j) => j !== i);
    onChange(next.length ? next : ['']);
    focus(Math.max(0, i - 1));
  }

  function move(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    focus(j);
  }

  /** Into the first blank row if there is one, otherwise on the end. */
  function add(values: string[]) {
    const next = [...items];
    for (const value of values) {
      if (next.length >= MAX_ITEMS && !next.some((x) => !x.trim())) break;
      const blank = next.findIndex((x) => !x.trim());
      if (blank >= 0) next[blank] = value;
      else next.push(value);
    }
    onChange(next);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    // Enter makes a new line, the way a list is typed — and stops the
    // editor's form treating it as "next step".
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items[i].trim()) insertAfter(i);
    } else if (e.key === 'Backspace' && !items[i] && items.length > 1) {
      e.preventDefault();
      remove(i);
    } else if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      move(i, -1);
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      move(i, 1);
    }
  }

  return (
    <div className="inc">
      <div className="inc-explain">
        <AdminIcon name="info" size={18} />
        <div>
          <strong>Khách nhận được những gì khi mua sản phẩm này?</strong>
          <span>
            Mỗi dòng là một thứ khách nhận được. Danh sách hiện ở trang sản phẩm, mục <b>{heading}</b>, mỗi dòng
            có dấu ✓ — như khung xem trước bên phải.
          </span>
        </div>
      </div>

      <div className="inc-grid">
        <div className="inc-editor">
          <div className="inc-rows">
            {items.map((item, i) => {
              const dup = item.trim() && duplicates.has(item.trim().toLowerCase());
              return (
                <div className={`inc-row${dup ? ' is-dup' : ''}`} key={i}>
                  <span className="inc-index">{i + 1}</span>
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    className="form-input"
                    maxLength={MAX_LEN}
                    placeholder={i === 0 ? 'VD: Cây cà chua mô phỏng 3D (8 giai đoạn)' : 'Thêm một thứ khách nhận được…'}
                    value={item}
                    onChange={(e) => setAt(i, e.target.value)}
                    onKeyDown={(e) => onKey(e, i)}
                  />
                  <div className="inc-row-actions">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Lên trên (Alt+↑)" aria-label="Lên trên">
                      <AdminIcon name="chevron-up" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      title="Xuống dưới (Alt+↓)"
                      aria-label="Xuống dưới"
                    >
                      <AdminIcon name="chevron-down" size={14} />
                    </button>
                    <button type="button" className="is-danger" onClick={() => remove(i)} title="Bỏ dòng này" aria-label="Bỏ dòng này">
                      <AdminIcon name="close" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="inc-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => insertAfter(items.length - 1)}
              disabled={items.length >= MAX_ITEMS}
            >
              <AdminIcon name="plus" size={14} /> Thêm dòng
            </button>
            <span>
              {filled.length} mục · Enter để xuống dòng mới
              {duplicates.size ? ' · có dòng bị trùng' : ''}
            </span>
          </div>

          {missing.length > 0 && (
            <div className="inc-suggest">
              <div className="inc-suggest-head">
                <span>Gợi ý thường dùng — bấm để thêm</span>
                <button type="button" className="inc-add-all" onClick={() => add(missing)}>
                  Thêm tất cả ({missing.length})
                </button>
              </div>
              <div className="inc-chips">
                {missing.map((s) => (
                  <button type="button" key={s} className="inc-chip" onClick={() => add([s])}>
                    <AdminIcon name="plus" size={12} /> {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Exactly what the product page renders, so there is no guessing. */}
        <aside className="inc-preview" aria-label="Xem trước">
          <span className="inc-preview-tag">
            <AdminIcon name="eye" size={13} /> Khách sẽ thấy
          </span>
          <h5>{heading}</h5>
          {filled.length ? (
            <ul>
              {filled.map((item, i) => (
                <li key={i}>
                  <span className="inc-check">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="inc-preview-empty">Chưa có mục nào — thêm ít nhất 1 dòng ở bên trái.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
