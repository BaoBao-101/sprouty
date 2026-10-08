import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginHref } from '@/services/auth-nav';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { API } from '@/services/api';
import { normalizeProduct } from '@/services/products';
import { formatPrice, type Product } from '@/types/product';
import './Vip.css';

/** Annual plans get the "best value" ribbon. */
function isAnnual(plan: Product) {
  return /annual|nam/i.test(plan.name) || /năm/i.test(plan.name);
}

export default function Vip() {
  const navigate = useNavigate();
  const { ready, isLoggedIn } = useAuth();
  const { add, register } = useCart();

  const [plans, setPlans] = useState<Product[]>([]);
  const [plansError, setPlansError] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [isVip, setIsVip] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    API.products
      .list({ category: 'membership' })
      .then((data: any) => {
        if (cancelled) return;
        const list = (data.products || []).map(normalizeProduct) as Product[];
        register(list);
        setPlans(list);
      })
      .catch((err: any) => !cancelled && setPlansError(err?.message || 'Không tải được gói VIP.'))
      .finally(() => !cancelled && setLoadingPlans(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Membership state only exists for a signed-in visitor.
  useEffect(() => {
    if (!ready || !isLoggedIn) {
      setIsVip(null);
      return;
    }
    let cancelled = false;
    API.redeem
      .entitlements()
      .then((data: any) => !cancelled && setIsVip(!!data.isVip))
      .catch(() => !cancelled && setIsVip(null));
    return () => {
      cancelled = true;
    };
  }, [ready, isLoggedIn]);

  function upgrade(planId: number) {
    if (!isLoggedIn) {
      navigate(loginHref());
      return;
    }
    add(planId, 1);
    navigate('/cart');
  }

  return (
    <>
      <div className="vip-hero">
        <div className="container">
          <h1>🌙 VIP Garden</h1>
          <p>Mở khóa thêm không gian cho Cây Kỷ Niệm — nhiều lá hơn, hiệu ứng đặc biệt và Plant Buddy đồng hành sâu sát hơn mỗi tháng.</p>
          {isVip !== null && (
            <div className="vip-status-chip">
              {isVip ? (
                <>
                  <img src="/assets/images/sprouty-icons/VIP.png" alt="" className="vip-chip-icon" />
                  Bạn đang là thành viên VIP Garden
                </>
              ) : (
                '🌱 Bạn đang dùng gói Thường'
              )}
            </div>
          )}
        </div>
      </div>

      <section style={{ padding: "0 0 20px" }}>
        <div className="container">
          <div className="vip-compare">
            <div className="vip-col">
              <h3>🌱 Thường</h3>
              <ul className="vip-feat-list">
                <li><span className="yes">✓</span> Tối đa <strong>10 lá</strong> kỷ niệm mỗi kit</li>
                <li><span className="yes">✓</span> Upload ảnh &amp; video kỷ niệm</li>
                <li><span className="yes">✓</span> Plant Buddy AI phản hồi mỗi lần thêm lá</li>
                <li><span className="no">✕</span> Night Mode &amp; hiệu ứng theo mùa</li>
                <li><span className="no">✕</span> Plant Buddies hiếm</li>
                <li><span className="no">✕</span> AI recap hàng tháng</li>
              </ul>
            </div>
            <div className="vip-col vip-highlight">
              <h3><img src="/assets/images/sprouty-icons/VIP.png" alt="" style={{ width: "20px", height: "20px", objectFit: "contain", verticalAlign: "middle", marginRight: "6px" }} />VIP Garden</h3>
              <ul className="vip-feat-list">
                <li><span className="yes">✓</span> Tối đa <strong>25 lá</strong> kỷ niệm mỗi kit</li>
                <li><span className="yes">✓</span> Upload ảnh &amp; video kỷ niệm</li>
                <li><span className="yes">✓</span> Plant Buddy AI phản hồi mỗi lần thêm lá</li>
                <li><span className="yes">✓</span> Night Mode &amp; hiệu ứng theo mùa</li>
                <li><span className="yes">✓</span> Plant Buddies hiếm</li>
                <li><span className="yes">✓</span> AI recap hàng tháng + ưu tiên hỗ trợ</li>
              </ul>
            </div>
          </div>

          <div className="vip-plans">
            {loadingPlans && <div className="vip-plans-msg">Đang tải gói VIP...</div>}
            {plansError && <div className="vip-plans-msg error">{plansError}</div>}
            {!loadingPlans && !plansError && plans.length === 0 && (
              <div className="vip-plans-msg">Chưa có gói VIP nào.</div>
            )}

            {plans.map((plan) => (
              <div className={`vip-plan-card${isAnnual(plan) ? ' best' : ''}`} key={plan.id}>
                {isAnnual(plan) && <span className="vip-plan-badge">Tiết kiệm nhất</span>}
                {plan.images[0] && <img src={plan.images[0]} alt={plan.name} className="vip-plan-img" />}
                <div className="vip-plan-name">{plan.name}</div>
                <div className="vip-plan-price">
                  {formatPrice(plan.price)}
                  {plan.old && <span className="vip-plan-old">{formatPrice(plan.old)}</span>}
                </div>
                <div className="vip-plan-period">{isAnnual(plan) ? 'mỗi năm' : 'mỗi tháng'}</div>
                <button className="btn btn-primary btn-lg btn-block" onClick={() => upgrade(plan.id)}>
                  <img src="/assets/images/sprouty-icons/VIP.png" alt="" className="vip-btn-icon" />
                  Nâng cấp ngay
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
