import { VipBenefits } from '@/components/VipBenefits';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginHref } from '@/services/auth-nav';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { bestValuePlanId, formatVipDate, planLength, planPerMonth, vipDaysLeft } from '@/services/membership';
import { formatPrice } from '@/types/product';
import { shortOrderId } from '@/types/order';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { VIP_PERKS } from '@/data/vip-perks';
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

const STEPS = [
  { title: 'Chọn gói', text: 'Gói nào cũng đủ quyền lợi.' },
  { title: 'Quét mã QR chuyển khoản', text: 'Trang thanh toán tự nhận tiền trong vài giây.' },
  { title: 'Tài khoản tự lên VIP', text: 'Không cần nhập mã kích hoạt.' },
];

/**
 * VIP Garden: the only place it is sold.
 *
 * It used to be a product in the shop. It went in the cart beside the kits,
 * came back as an activation code, and the parent had to type that code in to
 * become VIP — a second step for something they had already paid for. Now a
 * plan is bought here, on its own order, and the payment is the upgrade.
 *
 * Every plan gives the same benefits, so they are listed once beside the
 * plans rather than on each card; a card is a length, a price and a button.
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

  // Shortest first, so the cards read as a scale from a month to a year.
  const sorted = useMemo(() => [...plans].sort((a, b) => a.days - b.days || a.price - b.price), [plans]);
  const bestId = useMemo(() => bestValuePlanId(plans), [plans]);

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
      <section className="vip-hero">
        <div className="container vip-hero-in">
          <div className="vip-hero-text">
            <span className="vip-kicker">
              <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
              VIP Garden
            </span>
            <h1>Thêm không gian cho Cây Kỷ Niệm của bé</h1>
            <p>
              Bộ chăm tự động trông cây khi bé bận, cây đung đưa theo gió, kỷ niệm không giới hạn và Plant Buddy
              hỏi thoải mái. Thanh toán xong là tài khoản tự lên VIP — không cần nhập mã.
            </p>
          </div>

          {/* Where the account stands, before anything is offered to it. */}
          {mine ? (
            <div className={`vip-me${isVip ? ' is-vip' : mine.vipExpired ? ' is-expired' : ''}`}>
              <span className="vip-me-icon">
                {isVip ? (
                  <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
                ) : (
                  <SproutyIcon name={mine.vipExpired ? 'clock' : 'sprout'} size={22} />
                )}
              </span>
              <span className="vip-me-text">
                <em>Tài khoản của bạn</em>
                <strong>
                  {isVip ? 'Thành viên VIP Garden' : mine.vipExpired ? 'VIP đã hết hạn' : 'Tài khoản Thường'}
                </strong>
                <span>
                  {isVip ? (
                    <>Còn <b>{daysLeft} ngày</b> · hết hạn {formatVipDate(mine.vipUntil)}</>
                  ) : mine.vipExpired ? (
                    <>Hết hạn ngày {formatVipDate(mine.vipUntil)} — gia hạn để dùng tiếp quyền lợi VIP.</>
                  ) : (
                    'Chọn một gói bên dưới để nâng cấp.'
                  )}
                </span>
              </span>
            </div>
          ) : ready && !isLoggedIn ? (
            <div className="vip-me">
              <span className="vip-me-icon"><SproutyIcon name="user" size={22} /></span>
              <span className="vip-me-text">
                <em>Chưa đăng nhập</em>
                <strong>VIP gắn vào tài khoản của bạn</strong>
                <span><Link to={loginHref()}>Đăng nhập</Link> để chọn gói và thanh toán.</span>
              </span>
            </div>
          ) : null}
        </div>
      </section>

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

          <header className="vip-head">
            <h2>{isVip ? 'Gia hạn VIP' : 'Chọn gói VIP'}</h2>
            <p>Gói nào cũng đủ quyền lợi — chỉ khác thời hạn và giá.</p>
          </header>

          <div className="vip-shop">
          <div className="vip-plans">
            {loadingPlans && <div className="vip-plans-msg">Đang tải gói VIP…</div>}
            {plansError && <div className="vip-plans-msg error">{plansError}</div>}
            {!loadingPlans && !plansError && plans.length === 0 && (
              <div className="vip-plans-msg">Chưa có gói VIP nào.</div>
            )}

            {sorted.map((plan) => {
              const best = plan.id === bestId;
              const monthly = planPerMonth(plan.price, plan.days);
              const discount = plan.oldPrice && plan.oldPrice > plan.price
                ? Math.round((1 - plan.price / plan.oldPrice) * 100)
                : 0;
              const isPendingPlan = pending?.planId === plan.id;
              return (
                <article className={`vip-plan${best ? ' is-best' : ''}`} key={plan.id}>
                  <header className="vip-plan-head">
                    <h3>{plan.name}</h3>
                    {best && <span className="vip-plan-tag">Tiết kiệm nhất</span>}
                  </header>
                  <div className="vip-plan-price">
                    <strong>{formatPrice(plan.price)}</strong>
                    {discount > 0 && (
                      <>
                        <s>{formatPrice(plan.oldPrice!)}</s>
                        <span className="vip-plan-off">-{discount}%</span>
                      </>
                    )}
                  </div>
                  <p className="vip-plan-per">
                    <SproutyIcon name="calendar" size={15} />
                    {planLength(plan.days)} VIP
                    {monthly ? <> · khoảng {formatPrice(monthly)}/tháng</> : null}
                  </p>

                  <button
                    className="btn btn-primary btn-block vip-plan-btn"
                    disabled={buying !== null}
                    onClick={() =>
                      isPendingPlan
                        ? navigate(`/payment?orderId=${encodeURIComponent(pending!.id)}`)
                        : buy(plan)
                    }
                  >
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
                      : 'Chuyển khoản, VIP bật ngay khi tiền về.'}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="vip-perks">
            <h3>Gói nào cũng có</h3>
            <ul>
              {VIP_PERKS.map((perk) => (
                <li key={perk.label}>
                  <span className="vip-perk-icon"><SproutyIcon name={perk.icon} size={18} /></span>
                  {perk.label}
                </li>
              ))}
            </ul>
          </div>
          </div>

          <ol className="vip-how" aria-label="Cách nâng cấp">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="vip-how-n">{i + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <em>{step.text}</em>
                </span>
              </li>
            ))}
          </ol>

          <VipBenefits />
        </div>
      </section>
    </>
  );
}
