import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './CheckoutSteps.css';

// The last is the checkout done, not the order: a kit still has to arrive.
const STEPS = ['Giỏ hàng', 'Thông tin nhận hàng', 'Thanh toán', 'Đặt hàng xong'];

/**
 * Where the customer is in buying: the cart, the delivery details, paying,
 * done. Shown on the cart and the payment page so the four screens read as
 * one journey rather than as unrelated pages.
 *
 * A step already behind can be given an action (`onStep`), which makes it a
 * button: on the payment page, "Giỏ hàng" edits the order and "Thông tin
 * nhận hàng" opens the receiver's details.
 */
export function CheckoutSteps({
  current,
  onStep,
}: {
  current: 0 | 1 | 2 | 3;
  onStep?: Partial<Record<number, () => void>>;
}) {
  return (
    <ol className="ck-steps" aria-label="Các bước đặt hàng">
      {STEPS.map((label, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-now' : '';
        const action = i < current ? onStep?.[i] : undefined;
        const body = (
          <>
            <span className="ck-dot">{i < current ? <SproutyIcon name="check" size={14} /> : i + 1}</span>
            <span className="ck-label">{label}</span>
          </>
        );
        return (
          <li key={label} className={state} aria-current={i === current ? 'step' : undefined}>
            {action ? (
              <button type="button" className="ck-step-btn" onClick={action} title={`Quay lại: ${label}`}>
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
