import { useMemo, useState } from 'react';
import { Modal } from '@/components/admin/ui';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { planLength, planPerMonth } from '@/services/membership';
import { formatPrice } from '@/types/product';
import type { AdminProduct } from '@/components/ProductEditor';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { VIP_PERKS } from '@/data/vip-perks';

/** The lengths plans are usually sold in; any other is typed in days. */
const LENGTHS = [
  { days: 30, label: '1 tháng' },
  { days: 90, label: '3 tháng' },
  { days: 180, label: '6 tháng' },
  { days: 365, label: '1 năm' },
];

const STATUSES = [
  { value: 'published', label: 'Đang bán', hint: 'Hiện ở trang VIP' },
  { value: 'draft', label: 'Bản nháp', hint: 'Chưa mở bán' },
  { value: 'archived', label: 'Lưu trữ', hint: 'Ngừng bán' },
];

const digits = (value: string) => value.replace(/\D/g, '');

/**
 * Creating and editing a VIP plan.
 *
 * A plan is a length and a price. It used to open the five-step product
 * wizard — species, age range, photos, videos, what is in the box — none of
 * which a membership has. This asks only for what the VIP page shows, and
 * shows the card as customers will see it while it is filled in.
 */
export function VipPlanEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: AdminProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [days, setDays] = useState(String(editing?.membershipDays || 30));
  const [custom, setCustom] = useState(Boolean(editing?.membershipDays && !LENGTHS.some((l) => l.days === editing.membershipDays)));
  const [price, setPrice] = useState(editing ? String(editing.price) : '');
  const [oldPrice, setOldPrice] = useState(editing?.oldPrice ? String(editing.oldPrice) : '');
  const [description, setDescription] = useState(editing?.description || '');
  const [status, setStatus] = useState<string>(editing?.status || 'published');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dayCount = parseInt(days, 10) || 0;
  const priceValue = parseInt(price, 10) || 0;
  const oldValue = parseInt(oldPrice, 10) || 0;
  const monthly = planPerMonth(priceValue, dayCount);
  const discount = oldValue > priceValue && priceValue > 0 ? Math.round((1 - priceValue / oldValue) * 100) : 0;
  const shownName = name.trim() || (dayCount ? `Gói VIP ${planLength(dayCount)}` : 'Gói VIP');

  // The line kept on the plan for orders and the AI; written for the admin
  // when left empty, since the VIP page itself does not show it.
  const autoDescription = useMemo(
    () => `Gói VIP Garden ${dayCount ? planLength(dayCount) : ''}: khung cảnh và chậu đặc biệt, Bộ chăm tự động, Plant Buddy không giới hạn.`.replace('  ', ' '),
    [dayCount],
  );

  function problem() {
    if (shownName.length < 2) return 'Đặt tên cho gói.';
    if (!dayCount || dayCount < 1 || dayCount > 3660) return 'Thời hạn từ 1 ngày tới 10 năm.';
    if (!priceValue) return 'Nhập giá bán của gói.';
    if (oldValue && oldValue <= priceValue) return 'Giá gốc phải cao hơn giá bán (hoặc để trống).';
    const desc = description.trim() || autoDescription;
    if (desc.length < 10) return 'Mô tả cần ít nhất 10 ký tự.';
    return '';
  }

  async function save() {
    const message = problem();
    if (message) return setError(message);
    setError('');
    setBusy(true);
    const plan = {
      name: shownName,
      category: 'membership',
      membershipDays: dayCount,
      price: priceValue,
      oldPrice: oldValue || null,
      description: description.trim() || autoDescription,
      status,
    };
    try {
      if (editing) {
        // Only what a plan has; the rest of the row is left as it was.
        await API.admin.products.update(editing.id, plan);
        showToast('Đã lưu gói VIP', 'success');
      } else {
        // The catalogue asks every product for these; a plan has no age
        // range or collection of its own.
        await API.admin.products.create({
          ...plan,
          ageRange: 'Gia đình',
          collection: 'Vườn Vàng',
          speciesKey: null,
          smartPriceDelta: null,
          includes: [],
          images: [],
        });
        showToast('Đã tạo gói VIP', 'success');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không lưu được gói.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Sửa gói VIP' : 'Thêm gói VIP'}
      subtitle="Một gói là một thời hạn và một mức giá. Thẻ bên phải là cách khách thấy ở trang VIP."
      width={860}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Đang lưu…' : editing ? 'Lưu gói' : 'Tạo gói'}
          </button>
        </>
      }
    >
      <div className="vpe">
        <div className="vpe-form">
          <label className="field">
            <span className="field-label">Tên gói</span>
            <input
              className="form-input"
              value={name}
              placeholder={dayCount ? `Gói VIP ${planLength(dayCount)}` : 'Gói VIP'}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
            <span className="field-hint">Để trống sẽ đặt theo thời hạn, ví dụ “Gói VIP 1 năm”.</span>
          </label>

          <div className="field">
            <span className="field-label">Thời hạn</span>
            <div className="vpe-lengths" role="radiogroup" aria-label="Thời hạn gói">
              {LENGTHS.map((l) => (
                <button
                  key={l.days}
                  type="button"
                  role="radio"
                  aria-checked={!custom && dayCount === l.days}
                  className={`vpe-length${!custom && dayCount === l.days ? ' is-on' : ''}`}
                  onClick={() => { setCustom(false); setDays(String(l.days)); }}
                >
                  <strong>{l.label}</strong>
                  <em>{l.days} ngày</em>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={custom}
                className={`vpe-length${custom ? ' is-on' : ''}`}
                onClick={() => setCustom(true)}
              >
                <strong>Tuỳ chỉnh</strong>
                <em>Số ngày khác</em>
              </button>
            </div>
            {custom && (
              <div className="vpe-days">
                <input className="form-input" inputMode="numeric" value={days} onChange={(e) => setDays(digits(e.target.value))} />
                <span>ngày{dayCount ? ` · ${planLength(dayCount)}` : ''}</span>
              </div>
            )}
          </div>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">Giá bán</span>
              <div className="vpe-money">
                <input className="form-input" inputMode="numeric" value={price} placeholder="0" onChange={(e) => setPrice(digits(e.target.value))} />
                <span>đ</span>
              </div>
              <span className="field-hint">{priceValue ? formatPrice(priceValue) : 'Số tiền khách trả cho cả gói'}</span>
            </label>
            <label className="field">
              <span className="field-label">Giá gốc <em className="vpe-optional">(không bắt buộc)</em></span>
              <div className="vpe-money">
                <input className="form-input" inputMode="numeric" value={oldPrice} placeholder="0" onChange={(e) => setOldPrice(digits(e.target.value))} />
                <span>đ</span>
              </div>
              <span className="field-hint">{discount ? `Hiện gạch ngang, giảm ${discount}%` : 'Hiện gạch ngang khi cao hơn giá bán'}</span>
            </label>
          </div>

          <div className="field">
            <span className="field-label">Trạng thái</span>
            <div className="vpe-statuses" role="radiogroup" aria-label="Trạng thái">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={status === s.value}
                  className={`vpe-status is-${s.value}${status === s.value ? ' is-on' : ''}`}
                  onClick={() => setStatus(s.value)}
                >
                  <i />
                  <span><strong>{s.label}</strong><em>{s.hint}</em></span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Quyền lợi</span>
            <p className="vpe-perks-note">
              <AdminIcon name="check" size={15} />
              <span>Gói nào cũng có đủ {VIP_PERKS.length} quyền lợi VIP — chỉ khác thời hạn và giá. Hệ thống tự mở khi khách thanh toán xong.</span>
            </p>
          </div>

          <label className="field">
            <span className="field-label">Mô tả ngắn <em className="vpe-optional">(không bắt buộc)</em></span>
            <textarea className="form-input" rows={2} value={description} placeholder={autoDescription} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            <span className="field-hint">Ghi trên đơn hàng và cho Plant Buddy; để trống sẽ dùng câu gợi ý.</span>
          </label>

          {error && <div className="form-error">{error}</div>}
        </div>

        {/* The card as the VIP page draws it. */}
        <aside className="vpe-preview" aria-label="Xem trước trên trang VIP">
          <span className="vpe-preview-label"><AdminIcon name="eye" size={14} /> Khách sẽ thấy</span>
          <div className="vpe-card">
            <div className="vpe-card-name">{shownName}</div>
            <div className="vpe-card-price">
              <strong>{priceValue ? formatPrice(priceValue) : '—'}</strong>
              {discount > 0 && <><s>{formatPrice(oldValue)}</s><span>-{discount}%</span></>}
            </div>
            <div className="vpe-card-period">
              {dayCount ? planLength(dayCount) : '…'} VIP
              {monthly ? <> · khoảng {formatPrice(monthly)}/tháng</> : null}
            </div>
            <div className="vpe-card-btn">Nâng cấp ngay</div>
            <p className="vpe-card-note">Chuyển khoản, VIP bật ngay khi tiền về.</p>
          </div>
          {/* Said once under the plans on the VIP page, the same for every plan. */}
          <div className="vpe-perks">
            <strong>Gói nào cũng có</strong>
            <ul>
              {VIP_PERKS.map((perk) => (
                <li key={perk.label}><SproutyIcon name={perk.icon} size={14} />{perk.label}</li>
              ))}
            </ul>
          </div>
          <p className="vpe-best-note">
            Nhãn “Tiết kiệm nhất” tự gắn cho gói rẻ nhất tính theo ngày khi trang VIP có từ hai gói.
          </p>
          {status !== 'published' && (
            <p className="vpe-hidden"><AdminIcon name="info" size={14} /> Gói chưa hiện ở trang VIP khi chưa ở trạng thái “Đang bán”.</p>
          )}
        </aside>
      </div>
    </Modal>
  );
}
