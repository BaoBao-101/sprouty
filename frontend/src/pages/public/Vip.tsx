import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginHref } from '@/services/auth-nav';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatVipDate, planLength, vipDaysLeft } from '@/services/membership';
import { formatPrice } from '@/types/product';
import { shortOrderId } from '@/types/order';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './Vip.css';

interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  images: string[];
  includes: string[];
  badge: string | null;
  days: number;
}

interface MyMembership {
  tier: 'regular' | 'vip';
  isVip: boolean;
  vipUntil: string | null;
  vipExpired: boolean;
  pendingOrder: {
    id: string;
    total: number;
    planId: number | null;
    planName: string | null;
  } | null;
}

/** What a year costs per month, the comparison a parent actually makes. */
function perMonth(plan: Plan) {
  if (plan.days < 60) return null;
  return Math.round(plan.price / (plan.days / 30) / 1000) * 1000;
}

/**
 * VIP Garden: the only place it is sold.
 *
 * It used to be a product in the shop. It went in the cart beside the kits,
 * came back as an activation code, and the parent had to type that code in to
 * become VIP — a second step for something they had already paid for. Now a
 * plan is bought here, on its own order, and the payment is the upgrade.
 */
export default function Vip() {
  const navigate = useNavigate();
  const { ready, isLoggedIn, refreshUser } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansError, setPlansError] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [mine, setMine] = useState<MyMembership | null>(null);
  const [buying, setBuying] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    API.membership
      .plans()
      .then((data: any) => !cancelled && setPlans(data.plans || []))
      .catch((err: any) => !cancelled && setPlansError(err?.message || 'Không tải được gói VIP.'))
      .finally(() => !cancelled && setLoadingPlans(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Membership state only exists for a signed-in visitor. Refreshing the
  // session too keeps the header's badge in step with what this page says.
  useEffect(() => {
    if (!ready || !isLoggedIn) {
      setMine(null);
      return;
    }
    let cancelled = false;
    API.membership
      .mine()
      .then((data: any) => !cancelled && setMine(data))
      .catch(() => !cancelled && setMine(null));
    void refreshUser();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isLoggedIn]);

  async function buy(plan: Plan) {
    if (!isLoggedIn) {
      navigate(loginHref());
      return;
    }
    setBuying(plan.id);
    try {
      const data = await API.membership.checkout(plan.id);
      navigate(`/payment?orderId=${encodeURIComponent(data.order.id)}`);
    } catch (err: any) {
      showToast(err?.message || 'Không tạo được đơn VIP. Vui lòng thử lại.', 'error');
      setBuying(null);
    }
  }

  const isVip = Boolean(mine?.isVip);
  const daysLeft = vipDaysLeft(mine?.vipUntil);
  const pending = mine?.pendingOrder;

  return (
    <>
      <div className="vip-hero">
        <div className="container">
          <span className="vip-hero-kicker">
            <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
            VIP Garden
          </span>
          <h1>Thêm không gian cho Cây Kỷ Niệm của bé</h1>
          <p>
            Nhiều lá kỷ niệm hơn, hiệu ứng theo mùa và Plant Buddy đồng hành sâu sát hơn. Thanh toán
            xong là tài khoản tự lên VIP — không cần nhập mã.
          </p>

          {/* Where the account stands, before anything is offered to it. */}
          {mine && (
            <div className={`vip-status${isVip ? ' is-vip' : mine.vipExpired ? ' is-expired' : ''}`}>
              <span className="vip-status-icon">
                {isVip ? (
                  <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
                ) : (
                  <SproutyIcon name="sprout" size={22} />
                )}
              </span>
              <span className="vip-status-text">
                <strong>
                  {isVip
                    ? 'Bạn đang là thành viên VIP Garden'
                    : mine.vipExpired
                      ? 'Gói VIP của bạn đã hết hạn'
                      : 'Bạn đang dùng tài khoản Thường'}
                </strong>
                <em>
                  {isVip
                    ? `Còn ${daysLeft} ngày · hết hạn ${formatVipDate(mine.vipUntil)}`
                    : mine.vipExpired
                      ? `Hết hạn ngày ${formatVipDate(mine.vipUntil)} — gia hạn để dùng tiếp quyền lợi VIP.`
                      : 'Chọn một gói bên dưới để nâng cấp.'}
                </em>
              </span>
            </div>
          )}
        </div>
      </div>

      <section className="vip-body">
        <div className="container">
          {/* An unpaid VIP order is the first thing to finish, not a second
              order to start — paying both would buy the time twice. */}
          {pending && (
            <div className="vip-pending">
              <SproutyIcon name="ticket" size={22} />
              <div className="vip-pending-text">
                <strong>Bạn có đơn VIP chưa thanh toán</strong>
                <span>
                  {pending.planName || 'Gói VIP'} · {formatPrice(pending.total)} · mã đơn{' '}
                  {shortOrderId(pending.id)}
                </span>
              </div>
              <Link className="btn btn-primary" to={`/payment?orderId=${encodeURIComponent(pending.id)}`}>
                Tiếp tục thanh toán
                <SproutyIcon name="arrow-right" size={17} />
              </Link>
            </div>
          )}

          <ol className="vip-how">
            <li>
              <span className="vip-how-n">1</span>
              <div>
                <strong>Chọn gói</strong>
                <span>Theo tháng hoặc theo năm.</span>
              </div>
            </li>
            <li>
              <span className="vip-how-n">2</span>
              <div>
                <strong>Quét mã QR chuyển khoản</strong>
                <span>Trang thanh toán tự nhận tiền trong vài giây.</span>
              </div>
            </li>
            <li>
              <span className="vip-how-n">3</span>
              <div>
                <strong>Tài khoản tự lên VIP</strong>
                <span>Không cần nhập mã kích hoạt.</span>
              </div>
            </li>
          </ol>

          <div className="vip-plans">
            {loadingPlans && <div className="vip-plans-msg">Đang tải gói VIP…</div>}
            {plansError && <div className="vip-plans-msg error">{plansError}</div>}
            {!loadingPlans && !plansError && plans.length === 0 && (
              <div className="vip-plans-msg">Chưa có gói VIP nào.</div>
            )}

            {plans.map((plan) => {
              const best = plan.days >= 365;
              const monthly = perMonth(plan);
              const isPendingPlan = pending?.planId === plan.id;
              return (
                <div className={`vip-plan-card${best ? ' best' : ''}`} key={plan.id}>
                  {best && <span className="vip-plan-badge">Tiết kiệm nhất</span>}
                  {plan.images[0] && <img src={plan.images[0]} alt="" className="vip-plan-img" />}
                  <div className="vip-plan-name">{plan.name}</div>
                  <div className="vip-plan-price">
                    {formatPrice(plan.price)}
                    {plan.oldPrice && plan.oldPrice > plan.price && (
                      <span className="vip-plan-old">{formatPrice(plan.oldPrice)}</span>
                    )}
                  </div>
                  <div className="vip-plan-period">
                    {planLength(plan.days)} VIP
                    {monthly && <> · chỉ {formatPrice(monthly)}/tháng</>}
                  </div>

                  <button
                    className="btn btn-primary btn-lg btn-block"
                    disabled={buying !== null}
                    onClick={() =>
                      isPendingPlan
                        ? navigate(`/payment?orderId=${encodeURIComponent(pending!.id)}`)
                        : buy(plan)
                    }
                  >
                    <img src="/assets/images/sprouty-icons/VIP.png" alt="" className="vip-btn-icon" />
                    {buying === plan.id
                      ? 'Đang tạo đơn…'
                      : isPendingPlan
                        ? 'Thanh toán đơn đang chờ'
                        : isVip
                          ? `Gia hạn thêm ${planLength(plan.days)}`
                          : 'Nâng cấp ngay'}
                  </button>
                  <p className="vip-plan-note">
                    {isVip
                      ? `Cộng nối tiếp vào hạn hiện tại — đến ${formatVipDate(
                          new Date(
                            new Date(mine!.vipUntil!).getTime() + plan.days * 86_400_000,
                          ).toISOString(),
                        )}.`
                      : 'Thanh toán chuyển khoản, VIP bật ngay khi tiền về.'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="vip-compare">
            <div className="vip-col">
              <h3>
                <SproutyIcon name="sprout" size={20} /> Thường
              </h3>
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
              <h3>
                <img src="/assets/images/sprouty-icons/VIP.png" alt="" className="vip-col-icon" />
                VIP Garden
              </h3>
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
        </div>
      </section>
    </>
  );
}
