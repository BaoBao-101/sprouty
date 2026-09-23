import { useEffect, useState, type FormEvent } from 'react';
import { requireLogin } from '@/components/LoginModal';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

const FEATURE_LABEL: Record<string, string> = {
  ai_assistant: 'Trợ lý AI',
  instruction_videos: 'Video hướng dẫn',
  image_uploads: 'Upload ảnh',
};

interface RedeemResult {
  features: string[];
  productId?: number | null;
}

export default function Redeem() {
  const { ready, isLoggedIn } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && !isLoggedIn) requireLogin();
  }, [ready, isLoggedIn]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      requireLogin();
      return;
    }

    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await API.redeem.apply(code);
      setResult(data);
      showToast('Đã kích hoạt mã', 'success');
    } catch (err: any) {
      setError(err?.message || 'Không thể kích hoạt mã.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section-sm">
      <div className="container" style={{ maxWidth: 640 }}>
        <h1>Nhập mã kích hoạt</h1>
        <p className="lead">Kích hoạt trợ lý AI, video hướng dẫn hoặc thư viện ảnh cho kit của bạn.</p>

        <div className="redeem-card">
          <form onSubmit={submit}>
            <label className="form-label" htmlFor="redeem-code">
              Mã kích hoạt
            </label>
            <input
              className="form-input"
              id="redeem-code"
              autoComplete="one-time-code"
              required
              maxLength={128}
              placeholder="SPR-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy}>
              {busy ? 'Đang kích hoạt...' : 'Kích hoạt'}
            </button>
          </form>

          <div style={{ marginTop: 16 }}>
            {error && <div style={{ color: 'var(--rose)' }}>{error}</div>}
            {result && (
              <>
                <div className="redeem-ok">Đã kích hoạt mã.</div>
                <div>
                  {result.features.map((feature) => (
                    <span className="tag tag-green" style={{ marginRight: 6 }} key={feature}>
                      {FEATURE_LABEL[feature] ?? feature}
                    </span>
                  ))}
                </div>
                {result.productId && (
                  <p className="redeem-note">Áp dụng cho sản phẩm #{result.productId}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
