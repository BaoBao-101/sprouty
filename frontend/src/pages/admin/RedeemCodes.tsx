import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

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
  { value: 'ai_assistant', label: 'Trợ lý AI' },
  { value: 'instruction_videos', label: 'Video hướng dẫn' },
  { value: 'image_uploads', label: 'Upload ảnh' },
];

export default function RedeemCodes() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const [kits, setKits] = useState<KitOption[]>([]);
  const [label, setLabel] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['ai_assistant']);
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);

  const [viewing, setViewing] = useState<Code | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redemptionsMsg, setRedemptionsMsg] = useState('');

  const load = useCallback(() => {
    setState('loading');
    API.admin.redeemCodes
      .list()
      .then((data: any) => {
        setCodes(data.codes || []);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được mã.');
        setState('error');
      });
  }, []);

  useEffect(load, [load]);

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

  async function create() {
    try {
      const { codes: made } = await API.admin.redeemCodes.create({
        label: label.trim() || 'Mã Sprouty',
        features: selectedFeatures,
        productId: parseInt(productId, 10) || null,
        quantity: parseInt(quantity, 10) || 1,
        perUserLimit: 1,
      });
      setCreatedCodes(made.map((c: any) => c.code));
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không tạo được mã', 'error');
    }
  }

  async function disable(code: Code) {
    if (!confirm('Tắt mã này?')) return;
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
    setRedemptionsMsg('Đang tải...');
    setRedemptions([]);
    API.admin.redeemCodes
      .redemptions(code.id)
      .then((data: any) => {
        setRedemptions(data.redemptions || []);
        setRedemptionsMsg(data.redemptions?.length ? '' : 'Chưa có ai kích hoạt.');
      })
      .catch((err: any) => setRedemptionsMsg(err?.message || 'Không tải được.'));
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

  return (
    <>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <h1>Mã kích hoạt</h1>
        <p>Tạo và quản lý mã mở quyền cho khách hàng</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Tạo mã mới</h3>
        </div>
        <div style={{ padding: 16 }}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Nhãn</label>
              <input
                className="form-input"
                placeholder="VD: Mã tặng kèm Bean"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Áp dụng cho cây</label>
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
            </div>
            <div className="form-group">
              <label className="form-label">Số lượng mã</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Quyền lợi</label>
            <div className="rc-features">
              {FEATURES.map((feature) => (
                <label key={feature.value}>
                  <input
                    type="checkbox"
                    className="rc-feature"
                    value={feature.value}
                    checked={selectedFeatures.includes(feature.value)}
                    onChange={(e) => toggleFeature(feature.value, e.target.checked)}
                  />
                  {feature.label}
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" onClick={create}>
            Tạo mã
          </button>

          {createdCodes.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="rc-created-title">Mã mới, chỉ hiển thị lần này — hãy lưu lại:</div>
              <pre className="rc-created-list">{createdCodes.join('\n')}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Danh sách mã</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nhãn</th>
                <th>Quyền lợi</th>
                <th>Đã dùng</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {state === 'loading' && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {state === 'error' && (
                <tr>
                  <td colSpan={5} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {state === 'ready' && codes.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Chưa có mã.
                  </td>
                </tr>
              )}

              {codes.map((code) => (
                <tr key={code.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{code.label}</div>
                    <div className="admin-cell-sub">
                      {code.product?.name || 'Toàn bộ sản phẩm'}
                    </div>
                  </td>
                  <td style={{ fontSize: '.78rem' }}>{(code.features || []).join(', ')}</td>
                  <td>
                    {code.usedCount}
                    {code.maxUses ? `/${code.maxUses}` : ''}
                  </td>
                  <td>{code.status}</td>
                  <td>
                    <div className="admin-inline-actions">
                      <button className="act-btn" onClick={() => openRedemptions(code)}>
                        Lượt kích hoạt
                      </button>
                      <button className="act-btn act-del" onClick={() => disable(code)}>
                        Tắt
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Lượt kích hoạt — {viewing.label}</h3>
            <button className="act-btn" onClick={() => setViewing(null)}>
              Đóng
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Thời điểm</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {redemptionsMsg && (
                  <tr>
                    <td colSpan={3} className="admin-cell-empty">
                      {redemptionsMsg}
                    </td>
                  </tr>
                )}
                {redemptions.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.user?.name}</div>
                      <div className="admin-cell-sub">{r.user?.email}</div>
                    </td>
                    <td style={{ fontSize: '.82rem' }}>
                      {new Date(r.redeemedAt).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <button className="act-btn act-del" onClick={() => revoke(viewing.id, r.id)}>
                        Thu hồi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
