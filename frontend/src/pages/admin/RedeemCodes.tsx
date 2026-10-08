import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BlockStates,
  FilterPills,
  MeterBar,
  Modal,
  PageHeader,
  Panel,
  Pill,
  Pagination,
  SearchBox,
  StatCard,
  StatGrid,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { usePagedList } from '@/components/admin/usePagedList';

interface Code {
  id: string;
  label: string;
  features?: string[];
  usedCount: number;
  maxUses?: number | null;
  status: string;
  product?: { name?: string };
}

interface Redemption {
  id: string;
  redeemedAt: string;
  user?: { name?: string; email?: string };
}

interface KitOption {
  id: number;
  name: string;
  emoji?: string;
}

const FEATURES = [
  { value: 'ai_assistant', label: 'Trợ lý AI', icon: <AdminIcon name="spark" size={18} />, hint: 'Hỏi đáp chăm cây trong app' },
  { value: 'instruction_videos', label: 'Video hướng dẫn', icon: <AdminIcon name="video" size={18} />, hint: 'Xem video từng bước' },
  { value: 'image_uploads', label: 'Upload ảnh', icon: <AdminIcon name="images" size={18} />, hint: 'Đăng ảnh lên Cây Kỷ Niệm' },
];

const FEATURE_LABEL: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.value, f.label]),
);

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  disabled: 'Đã tắt',
  used_up: 'Đã dùng hết',
};

const STATUS_TONE: Record<string, string> = {
  active: 'green',
  disabled: 'grey',
  used_up: 'amber',
};

type Filter = '' | 'active' | 'disabled';

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

export default function RedeemCodes() {
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');

  // Server-paged. The tiles below read `counts` and `usedTotal`, which the
  // endpoint computes over the whole table — a headline figure that changed
  // when you turned the page would be worse than no figure at all.
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
    { status: filter, search: search.trim() },
    { errorText: 'Không tải được mã.' },
  );

  const [kits, setKits] = useState<KitOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [label, setLabel] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['ai_assistant']);
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

  function openCreate() {
    setLabel('');
    setProductId('');
    setQuantity('1');
    setSelectedFeatures(['ai_assistant']);
    setFormError('');
    setCreating(true);
  }

  async function create() {
    setFormError('');
    if (selectedFeatures.length === 0) {
      return setFormError('Chọn ít nhất một quyền lợi cho mã.');
    }
    const count = parseInt(quantity, 10);
    if (!count || count < 1 || count > 500) {
      return setFormError('Số lượng mã phải từ 1 đến 500.');
    }

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
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Không tạo được mã');
    } finally {
      setBusy(false);
    }
  }

  async function disable(code: Code) {
    if (!confirm(`Tắt mã “${code.label}”?\n\nMã đã tắt không thể kích hoạt được nữa.`)) return;
    try {
      await API.admin.redeemCodes.remove(code.id);
      showToast('Đã tắt mã', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không tắt được mã', 'error');
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

  async function revoke(codeId: string, redemptionId: string) {
    if (
      !confirm(
        'Thu hồi lượt kích hoạt này? Người dùng đó sẽ mất quyền lợi đã được cấp từ mã này, và mã sẽ mở lại cho người khác.',
      )
    )
      return;
    try {
      await API.admin.redeemCodes.revokeRedemption(codeId, redemptionId);
      showToast('Đã thu hồi lượt kích hoạt', 'success');
      if (viewing) openRedemptions(viewing);
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không thu hồi được', 'error');
    }
  }

  function toggleFeature(value: string, checked: boolean) {
    setSelectedFeatures((list) =>
      checked ? [...new Set([...list, value])] : list.filter((f) => f !== value),
    );
  }

  const activeCount = counts.active || 0;
  const disabledCount = Object.entries(counts).reduce(
    (sum, [status, n]) => (status === 'active' ? sum : sum + n),
    0,
  );
  const codeTotal = activeCount + disabledCount;
  const usedTotal = raw?.usedTotal || 0;

  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: codeTotal },
    { value: 'active', label: 'Đang hoạt động', count: activeCount },
    { value: 'disabled', label: 'Đã tắt', count: disabledCount },
  ];

  return (
    <>
      <PageHeader
        title="Mã kích hoạt"
        subtitle="Tạo và quản lý mã mở quyền cho khách hàng"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            + Tạo mã mới
          </button>
        }
      />

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="ticket" />}
          tone="orange"
          loading={state === 'loading'}
          value={codeTotal}
          label="Tổng số mã"
        />
        <StatCard
          icon={<AdminIcon name="check" />}
          tone="green"
          loading={state === 'loading'}
          value={activeCount}
          label="Đang hoạt động"
        />
        <StatCard
          icon={<AdminIcon name="user" />}
          tone="blue"
          loading={state === 'loading'}
          value={usedTotal}
          label="Lượt đã kích hoạt"
        />
      </StatGrid>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={(next) => setFilter(next)} />
        <SearchBox value={search} placeholder="Tìm theo nhãn hoặc cây…" onChange={setSearch} />
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nhãn</th>
              <th>Quyền lợi</th>
              <th style={{ minWidth: 140 }}>Đã dùng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={codes.length === 0}
              columns={5}
              emptyIcon={<AdminIcon name="ticket" size={24} />}
              emptyTitle={
                search || filter ? 'Không tìm thấy mã nào' : 'Chưa có mã kích hoạt nào'
              }
              emptyHint={
                search || filter
                  ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.'
                  : 'Bấm “Tạo mã mới” để phát hành lô mã đầu tiên.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              codes.map((code) => (
                <tr key={code.id}>
                  <td>
                    <div className="ad-cell-main">{code.label}</div>
                    <div className="ad-cell-sub">{code.product?.name || 'Toàn bộ sản phẩm'}</div>
                  </td>
                  <td>
                    <div className="rc-feature-tags">
                      {(code.features || []).map((f) => (
                        <Pill tone="blue" key={f}>
                          {FEATURE_LABEL[f] ?? f}
                        </Pill>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="ad-cell-main">
                      {code.usedCount}
                      {code.maxUses ? ` / ${code.maxUses}` : ''}
                    </div>
                    {code.maxUses ? (
                      <MeterBar value={code.usedCount} max={code.maxUses} tone="orange" />
                    ) : (
                      <div className="ad-cell-sub">Không giới hạn</div>
                    )}
                  </td>
                  <td>
                    <Pill tone={STATUS_TONE[code.status] ?? 'grey'}>
                      {STATUS_LABEL[code.status] ?? code.status}
                    </Pill>
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      <button className="act-btn act-edit" onClick={() => openRedemptions(code)}>
                        Lượt kích hoạt
                      </button>
                      {code.status === 'active' && (
                        <button className="act-btn act-del" onClick={() => disable(code)}>
                          Tắt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        <Pagination page={page} pages={pages} total={total} unit="mã" onChange={setPage} />
      </Panel>

      {creating && (
        <Modal
          title="Tạo mã kích hoạt"
          subtitle="Mã chỉ hiển thị một lần duy nhất sau khi tạo"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={create}>
                {busy ? 'Đang tạo…' : `Tạo ${parseInt(quantity, 10) || 1} mã`}
              </button>
            </>
          }
        >
          <div className="field-grid">
            <label className="field">
              <span className="field-label">Nhãn</span>
              <input
                className="form-input"
                placeholder="VD: Mã tặng kèm Bean"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <span className="field-hint">Chỉ nhân viên thấy, để phân biệt các lô mã</span>
            </label>

            <label className="field">
              <span className="field-label">Số lượng mã</span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <span className="field-hint">Mỗi mã dùng được 1 lần</span>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Áp dụng cho cây</span>
            <select
              className="form-input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Toàn bộ sản phẩm</option>
              {kits.map((kit) => (
                <option value={kit.id} key={kit.id}>
                  {kit.emoji || '🌱'} {kit.name}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Chọn một cây để mã chỉ mở quyền cho đúng sản phẩm đó
            </span>
          </label>

          <div className="field">
            <span className="field-label">
              Quyền lợi <span className="req">*</span>
            </span>
            <div className="status-choices">
              {FEATURES.map((feature) => {
                const checked = selectedFeatures.includes(feature.value);
                return (
                  <label
                    key={feature.value}
                    className={`status-choice${checked ? ' active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleFeature(feature.value, e.target.checked)}
                    />
                    <div>
                      <strong>
                        {feature.icon} {feature.label}
                      </strong>
                      <div className="status-choice-hint">{feature.hint}</div>
                    </div>
                  </label>
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
          subtitle="Lưu lại ngay — sau khi đóng cửa sổ này mã sẽ không hiển thị lại"
          onClose={() => setCreatedCodes(null)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => copyText(createdCodes.join('\n'), 'Đã sao chép toàn bộ mã')}
              >
                Sao chép tất cả
              </button>
              <button className="btn btn-primary" onClick={() => setCreatedCodes(null)}>
                Tôi đã lưu lại
              </button>
            </>
          }
        >
          <div className="panel-note">
            Mã được sinh ngẫu nhiên và không lưu dạng đọc được trên hệ thống. Nếu đóng mà chưa
            lưu, bạn phải tạo lô mới.
          </div>
          <div className="rc-codes">
            {createdCodes.map((code) => (
              <button
                key={code}
                className="rc-code"
                title="Bấm để sao chép"
                onClick={() => copyText(code, 'Đã sao chép mã')}
              >
                <code>{code}</code>
                <AdminIcon name="copy" size={15} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal
          title="Lượt kích hoạt"
          subtitle={viewing.label}
          onClose={() => setViewing(null)}
          footer={
            <button className="btn btn-ghost" onClick={() => setViewing(null)}>
              Đóng
            </button>
          }
        >
          <BlockStates
            state={redemptionState}
            error={redemptionError}
            isEmpty={redemptions.length === 0}
            emptyIcon={<AdminIcon name="user" size={24} />}
            emptyTitle="Chưa có ai kích hoạt"
            emptyHint="Khi khách nhập mã, lượt kích hoạt sẽ hiện ở đây."
          />
          {redemptionState === 'ready' &&
            redemptions.map((r) => (
              <div className="rc-redemption" key={r.id}>
                <div>
                  <div className="ad-cell-main">{r.user?.name || '—'}</div>
                  <div className="ad-cell-sub">{r.user?.email}</div>
                  <div className="ad-cell-sub">
                    {new Date(r.redeemedAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <button className="act-btn act-del" onClick={() => revoke(viewing.id, r.id)}>
                  Thu hồi
                </button>
              </div>
            ))}
        </Modal>
      )}
    </>
  );
}
