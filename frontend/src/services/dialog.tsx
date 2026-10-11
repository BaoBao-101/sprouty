import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './dialog.css';

type Options = { title?: string; confirmLabel?: string; danger?: boolean };
let queue: Promise<unknown> = Promise.resolve();

function Popup({ message, options, finish }: { message: string; options: Options; finish: (value: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const danger = options.danger ?? /xoá|xóa|vĩnh viễn|thu hồi|vô hiệu|hủy|huỷ/i.test(message);
  useEffect(() => {
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    cancel.current?.focus();
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} className={`sprouty-dialog${danger ? ' is-danger' : ''}`} aria-labelledby="sprouty-dialog-title" aria-describedby="sprouty-dialog-message" onCancel={(event) => { event.preventDefault(); finish(false); }}>
    <div className="sprouty-dialog-content">
      <span className="sprouty-dialog-icon"><SproutyIcon name={danger ? 'warning' : 'leaf'} size={28} /></span>
      <button className="sprouty-dialog-close" aria-label="Đóng" onClick={() => finish(false)}><SproutyIcon name="close" size={20} /></button>
      <span className="sprouty-dialog-eyebrow">SPROUTY</span>
      <h2 id="sprouty-dialog-title">{options.title || (danger ? 'Xác nhận thao tác' : 'Bạn muốn tiếp tục?')}</h2>
      <p id="sprouty-dialog-message">{message}</p>
    </div>
    <div className="sprouty-dialog-actions">
      <button ref={cancel} className="sprouty-dialog-cancel" onClick={() => finish(false)}>Hủy</button>
      <button className="sprouty-dialog-confirm" onClick={() => finish(true)}>{options.confirmLabel || 'Xác nhận'}</button>
    </div>
  </dialog>;
}

/** Await before performing the action. Requests are queued, never stacked. */
export function confirmAction(message: string, options: Options = {}): Promise<boolean> {
  const request = queue.then(() => new Promise<boolean>((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      // Leave the React event before removing its root.
      queueMicrotask(() => {
        root.unmount();
        host.remove();
        if (previous?.isConnected) previous.focus();
        resolve(value);
      });
    };
    root.render(<Popup message={message} options={options} finish={finish} />);
  }));
  queue = request.catch(() => undefined);
  return request;
}
