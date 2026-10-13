import { confirmAction } from '@/services/dialog';
import { useCallback, useEffect, useState } from 'react';
import {
  BlockStates,
  FilterPills,
  Modal,
  PageHeader,
  Panel,
  Pagination,
  SearchBox,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import { usePagedList } from '@/components/admin/usePagedList';
import './RedeemCodes.css';

interface Code {
  id: string;
  label: string;
  features?: string[];
  usedCount: number;
  maxUses?: number | null;
  status: string;
  createdAt?: string;
  product?: { name?: string; category?: string };
}

interface Redemption {
  id: string;
  redeemedAt: string;
  user?: { name?: string; email?: string };
}

interface KitOption {
  id: number;
  name: string;
}

// What a code can unlock. "Trợ lý AI" is no longer one: every account has it
// (5 questions a day, unlimited with VIP), so a code carrying it gave nothing.
const FEATURES: Array<{ value: string; label: string; icon: AdminIconName; hint: string }> = [
  { value: 'instruction_videos', label: 'Video hướng dẫn', icon: 'video', hint: 'Xem video từng bước của bộ kit' },
  { value: 'image_uploads', label: 'Upload ảnh', icon: 'images', hint: 'Đăng ảnh, video lên Cây Kỷ Niệm' },
];
const FEATURE: Record<string, { label: string; icon: AdminIconName; hint: string }> = {
  ...Object.fromEntries(FEATURES.map((f) => [f.value, f])),
  // Older codes still list it; it is shown for what it is.
  ai_assistant: { label: 'Trợ lý AI', icon: 'spark', hint: 'Mọi tài khoản đều đã có — mã không cần mang quyền lợi này' },
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  disabled: 'Đã tắt',
  used_up: 'Đã dùng hết',
  expired: 'Hết hạn',
};

/** Codes a paid order issued are labelled "Mã sau mua hàng <order>". */
const ORDER_LABEL = 'Mã sau mua hàng';

type Source = 'manual' | 'order';
type Filter = '' | 'active' | 'disabled' | 'unused';

async function copyText(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message, 'success');
  } catch {
    // Clipboard access is blocked outside a secure context (plain http on a LAN
    // IP, for instance), so say so rather than failing silently.
    showToast('Trình duyệt chặn sao chép — hãy bôi đen và copy thủ công.', 'error');
  }
}

/** How a code reads in the list: an order's code by its order. */
function codeTitle(code: Code) {
  if (code.label.startsWith(ORDER_LABEL)) return `Đơn #${code.label.slice(ORDER_LABEL.length).trim()}`;
  return code.label;
}

export default function RedeemCodes() {
  // The codes an admin actually manages — made by hand for gifts, workshops
  // and promotions — come first. The ones every paid order issues are a
  // second tab: there to look up and to see who has not activated yet.
  const [source, setSource] = useState<Source>('manual');
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');

  const {
    items: codes,
    state,
    error,
    page,
    pages,
    total,
    counts,
    raw,
    setPage,
    reload: load,
  } = usePagedList<Code>(
    (params) => API.admin.redeemCodes.list(params),
    'codes',
    {
      source,
      status: filter === 'unused' ? '' : filter,
      unused: filter === 'unused' ? '1' : '',
      search: search.trim(),
    },
    { errorText: 'Không tải được mã.' },
  );

  const [kits, setKits] = useState<KitOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [label, setLabel] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['instruction_videos', 'image_uploads']);
  const [createdCodes, setCreatedCodes] = useState<string[] | null>(null);

  const [viewing, setViewing] = useState<Code | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redemptionState, setRedemptionState] = useState<LoadState>('loading');
  const [redemptionError, setRedemptionError] = useState('');

  // Only kits can carry a redeem code, so the picker lists just those.
  useEffect(() => {
    let cancelled = false;
    API.admin.products
      .list({ status: 'published' })
      .then((data: any) => {
        if (cancelled) return;
        setKits((data.products || []).filter((p: any) => p.category === 'kit'));
      })
      .catch((err: any) => showToast(err?.message || 'Không tải được danh sách cây', 'error'));
    return () => {
      cancelled = true;
    };
  }, []);

  function switchSource(next: Source) {
    setSource(next);
    setFilter('');
    setPage(1);
  }

  function openCreate() {
    setLabel('');
    setProductId('');
    setQuantity('1');
    setSelectedFeatures(['instruction_videos', 'image_uploads']);
    setFormError('');
    setCreating(true);
  }

  async function create() {
    setFormError('');
    if (selectedFeatures.length === 0) return setFormError('Chọn ít nhất một quyền lợi cho mã.');
    const count = parseInt(quantity, 10);
    if (!count || count < 1 || count > 500) return setFormError('Số lượng mã phải từ 1 đến 500.');

    setBusy(true);
    try {
      const { codes: made } = await API.admin.redeemCodes.create({
        label: label.trim() || 'Mã Sprouty',
        features: selectedFeatures,
        productId: parseInt(productId, 10) || null,
        quantity: count,
        perUserLimit: 1,
      });
      setCreating(false);
      setCreatedCodes(made.map((c: any) => c.code));
      if (source !== 'manual') switchSource('manual');
      else load();
    } catch (err: any) {
      setFormError(err?.message || 'Không tạo được mã');
    } finally {
      setBusy(false);
    }
  }

  // Only a code made by hand can be stopped — a promotion that ended, a code
  // posted somewhere it should not be. A code an order issued belongs to the
  // customer who paid, and the server refuses it too.
  async function stop(code: Code) {
    if (
      !await confirmAction(
        `Ngừng phát mã “${codeTitle(code)}”?\n\nMã chưa dùng sẽ không nhập được nữa. Ai đã kích hoạt vẫn giữ nguyên quyền lợi.`,
        { title: 'Ngừng phát mã', confirmLabel: 'Ngừng phát' },
      )
    )
      return;
    try {
      await API.admin.redeemCodes.remove(code.id);
      showToast('Đã ngừng phát mã', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không ngừng phát được mã', 'error');
    }
  }

  const openRedemptions = useCallback((code: Code) => {
    setViewing(code);
    setRedemptionState('loading');
    setRedemptions([]);
    API.admin.redeemCodes
      .redemptions(code.id)
      .then((data: any) => {
        setRedemptions(data.redemptions || []);
        setRedemptionState('ready');
      })
      .catch((err: any) => {
        setRedemptionError(err?.message || 'Không tải được.');
        setRedemptionState('error');
      });
  }, []);

  function toggleFeature(value: string) {
    setSelectedFeatures((list) => (list.includes(value) ? list.filter((f) => f !== value) : [...list, value]));
  }

  const activeCount = counts.active || 0;
  const offCount = Object.entries(counts).reduce((sum, [status, n]) => (status === 'active' ? sum : sum + n), 0);
  const sources = raw?.sources || { manual: 0, order: 0 };
  const orderUnused = raw?.orderUnused || 0;
  const manualActive = raw?.manualActive || 0;
  const usedTotal = raw?.usedTotal || 0;

  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: activeCount + offCount },
    { value: 'active', label: 'Đang hoạt động', count: activeCount },
    { value: 'disabled', label: 'Đã tắt', count: offCount },
    ...(source === 'order' ? [{ value: 'unused' as Filter, label: 'Chưa kích hoạt', count: orderUnused }] : []),
  ];
  const filtered = Boolean(search || filter);

  return (
    <>
      <PageHeader
        title="Mã kích hoạt"
        subtitle="Mã quà tặng, mã workshop và mã khách nhận sau khi mua kit"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <AdminIcon name="plus" size={16} /> Tạo mã
          </button>
        }
      />

      <div className="ax-kpis rcx-kpis">
        <button type="button" className={`ax-kpi tone-green${source === 'manual' && filter === 'active' ? ' is-active' : ''}`} onClick={() => { switchSource('manual'); setFilter('active'); }}>
          <span className="ax-kpi-icon"><AdminIcon name="ticket" size={18} /></span>
          <span className="ax-kpi-body">
            <b>{manualActive}</b>
            <strong>Mã tạo tay còn dùng được</strong>
            <em>Quà tặng, workshop, khuyến mãi</em>
          </span>
        </button>
        <button type="button" className={`ax-kpi tone-amber${source === 'order' && filter === 'unused' ? ' is-active' : ''}`} onClick={() => { switchSource('order'); setFilter('unused'); }}>
          <span className="ax-kpi-icon"><AdminIcon name="clock" size={18} /></span>
          <span className="ax-kpi-body">
            <b>{orderUnused}</b>
            <strong>Khách chưa kích hoạt</strong>
            <em>Đã mua kit nhưng chưa gieo cây</em>
          </span>
        </button>
        <div className="ax-kpi tone-blue is-static">
          <span className="ax-kpi-icon"><AdminIcon name="user" size={18} /></span>
          <span className="ax-kpi-body">
            <b>{usedTotal}</b>
            <strong>Lượt đã kích hoạt</strong>
            <em>Trên mọi mã</em>
          </span>
        </div>
      </div>

      <div className="rcx-tabs" role="tablist" aria-label="Nguồn mã">
        <button type="button" role="tab" aria-selected={source === 'manual'} className={`rcx-tab${source === 'manual' ? ' is-active' : ''}`} onClick={() => switchSource('manual')}>
          <AdminIcon name="ticket" size={16} /> Mã tạo tay <span>{sources.manual}</span>
        </button>
        <button type="button" role="tab" aria-selected={source === 'order'} className={`rcx-tab${source === 'order' ? ' is-active' : ''}`} onClick={() => switchSource('order')}>
          <AdminIcon name="orders" size={16} /> Theo đơn hàng <span>{sources.order}</span>
        </button>
      </div>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={(next) => { setFilter(next); setPage(1); }} />
        <SearchBox value={search} placeholder={source === 'order' ? 'Tìm theo mã đơn hoặc cây…' : 'Tìm theo nhãn hoặc cây…'} onChange={setSearch} />
      </Toolbar>

      <Panel flush>
        <table className="admin-table rcx-table">
          <thead>
            <tr>
              <th>{source === 'order' ? 'Đơn hàng' : 'Mã'}</th>
              <th>Quyền lợi</th>
              <th>Đã dùng</th>
              <th>Trạng thái</th>
              <th aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={codes.length === 0}
              columns={5}
              emptyIcon={<AdminIcon name="ticket" size={24} />}
              emptyTitle={filtered ? 'Không tìm thấy mã nào' : source === 'manual' ? 'Chưa có mã tạo tay' : 'Chưa có mã theo đơn'}
              emptyHint={
                filtered
                  ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.'
                  : source === 'manual'
                    ? 'Bấm “Tạo mã” để phát mã tặng khách hoặc phát ở workshop.'
                    : 'Mỗi đơn mua kit đã thanh toán sẽ tự sinh mã ở đây.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              codes.map((code) => {
                const usedUp = Boolean(code.maxUses && code.usedCount >= code.maxUses);
                return (
                  <tr key={code.id} className={code.status !== 'active' ? 'is-off' : ''}>
                    <td>
                      <div className="rcx-code">
                        <span className="rcx-code-icon" aria-hidden="true">
                          <AdminIcon name={code.label.startsWith(ORDER_LABEL) ? 'orders' : 'ticket'} size={16} />
                        </span>
                        <span>
                          <span className="rcx-main">{codeTitle(code)}</span>
                          <span className="rcx-sub">
                            {code.product?.name || 'Mọi bộ kit'}
                            {code.createdAt ? ` · tạo ${new Date(code.createdAt).toLocaleDateString('vi-VN')}` : ''}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="rcx-features">
                        {/* A kit's code grows its plant — the main thing a
                            buyer gets, and it was missing from this column. */}
                        {code.product?.name && code.product.category !== 'membership' && (
                          <span className="rcx-feature is-plant" title={`Gieo cây ${code.product.name}`}>
                            <AdminIcon name="seed" size={13} /> Gieo cây
                          </span>
                        )}
                        {(code.features || []).map((f) => (
                          <span key={f} className={`rcx-feature${f === 'ai_assistant' ? ' is-muted' : ''}`} title={FEATURE[f]?.hint}>
                            <AdminIcon name={FEATURE[f]?.icon || 'check'} size={13} />
                            {FEATURE[f]?.label ?? f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {code.usedCount === 0 ? (
                        <span className="rcx-unused">Chưa ai dùng</span>
                      ) : (
                        <div className="rcx-usage">
                          <span>{code.usedCount}{code.maxUses ? `/${code.maxUses}` : ''} lượt</span>
                          {code.maxUses ? (
                            <span className="rcx-meter"><span style={{ width: `${Math.min(100, (code.usedCount / code.maxUses) * 100)}%` }} /></span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`rcx-status is-${usedUp && code.status === 'active' ? 'used_up' : code.status}`}>
                        <i />
                        {usedUp && code.status === 'active' ? 'Đã dùng hết' : STATUS_LABEL[code.status] ?? code.status}
                      </span>
                    </td>
                    <td>
                      <div className="rcx-actions">
                        <button type="button" className="rcx-btn" onClick={() => openRedemptions(code)}>
                          <AdminIcon name="user" size={14} /> Ai đã dùng
                        </button>
                        {code.status === 'active' && !code.label.startsWith(ORDER_LABEL) && !usedUp && (
                          <button type="button" className="rcx-btn is-danger" onClick={() => stop(code)}>
                            Ngừng phát
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Panel>
      <Pagination page={page} pages={pages} total={total} unit="mã" onChange={setPage} />

      {creating && (
        <Modal
          title="Tạo mã kích hoạt"
          subtitle="Dùng để tặng khách, phát ở workshop hoặc khuyến mãi. Mã chỉ hiện một lần sau khi tạo."
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Huỷ</button>
              <button className="btn btn-primary" disabled={busy} onClick={create}>
                {busy ? 'Đang tạo…' : `Tạo ${parseInt(quantity, 10) || 1} mã`}
              </button>
            </>
          }
        >
          <div className="field-grid">
            <label className="field">
              <span className="field-label">Tên lô mã</span>
              <input className="form-input" placeholder="VD: Workshop tháng 11" value={label} onChange={(e) => setLabel(e.target.value)} />
              <span className="field-hint">Chỉ nhân viên thấy, để nhận ra lô mã sau này</span>
            </label>
            <label className="field">
              <span className="field-label">Số lượng mã</span>
              <input className="form-input" type="number" min={1} max={500} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <span className="field-hint">Mỗi mã dùng được một lần</span>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Bộ kit được gieo</span>
            <select className="form-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Mọi bộ kit</option>
              {kits.map((kit) => <option value={kit.id} key={kit.id}>{kit.name}</option>)}
            </select>
            <span className="field-hint">Chọn một bộ kit để mã chỉ mở đúng cây đó</span>
          </label>

          <div className="field">
            <span className="field-label">Quyền lợi kèm theo <span className="req">*</span></span>
            <div className="rcx-choices">
              {FEATURES.map((feature) => {
                const checked = selectedFeatures.includes(feature.value);
                return (
                  <button
                    type="button"
                    key={feature.value}
                    role="checkbox"
                    aria-checked={checked}
                    className={`rcx-choice${checked ? ' is-on' : ''}`}
                    onClick={() => toggleFeature(feature.value)}
                  >
                    <span className="rcx-choice-icon"><AdminIcon name={feature.icon} size={18} /></span>
                    <span>
                      <strong>{feature.label}</strong>
                      <em>{feature.hint}</em>
                    </span>
                    <span className="rcx-check" aria-hidden="true">{checked && <AdminIcon name="check" size={12} />}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {formError && <div className="form-error">{formError}</div>}
        </Modal>
      )}

      {createdCodes && (
        <Modal
          title={`Đã tạo ${createdCodes.length} mã`}
          subtitle="Lưu lại ngay — đóng cửa sổ này rồi mã sẽ không hiện lại"
          onClose={() => setCreatedCodes(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => copyText(createdCodes.join('\n'), 'Đã sao chép toàn bộ mã')}>
                <AdminIcon name="copy" size={15} /> Sao chép tất cả
              </button>
              <button className="btn btn-primary" onClick={() => setCreatedCodes(null)}>Tôi đã lưu lại</button>
            </>
          }
        >
          <div className="rcx-warn">
            <AdminIcon name="alert" size={16} />
            Mã được sinh ngẫu nhiên và không lưu dạng đọc được trên hệ thống. Nếu đóng mà chưa lưu, bạn phải tạo lô mới.
          </div>
          <div className="rc-codes">
            {createdCodes.map((code) => (
              <button key={code} className="rc-code" title="Bấm để sao chép" onClick={() => copyText(code, 'Đã sao chép mã')}>
                <code>{code}</code>
                <AdminIcon name="copy" size={15} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal
          title="Ai đã dùng mã này"
          subtitle={codeTitle(viewing)}
          onClose={() => setViewing(null)}
          footer={<button className="btn btn-ghost" onClick={() => setViewing(null)}>Đóng</button>}
        >
          <BlockStates
            state={redemptionState}
            error={redemptionError}
            isEmpty={redemptions.length === 0}
            emptyIcon={<AdminIcon name="user" size={24} />}
            emptyTitle="Chưa có ai kích hoạt"
            emptyHint="Khi khách nhập mã, lượt kích hoạt sẽ hiện ở đây."
          />
          {redemptionState === 'ready' && redemptions.length > 0 && (
            <>
            <p className="rcx-note">Quyền lợi đã kích hoạt là của khách. Trang này chỉ để tra cứu khi cần hỗ trợ.</p>
            <ul className="rcx-redemptions">
              {redemptions.map((r) => (
                <li key={r.id}>
                  <span className="rcx-avatar" aria-hidden="true">{(r.user?.name || '?').trim().charAt(0).toUpperCase()}</span>
                  <span className="rcx-red-who">
                    <span className="rcx-main">{r.user?.name || '—'}</span>
                    <span className="rcx-sub">{r.user?.email}</span>
                  </span>
                  <span className="rcx-when">{new Date(r.redeemedAt).toLocaleString('vi-VN')}</span>
                </li>
              ))}
            </ul>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
