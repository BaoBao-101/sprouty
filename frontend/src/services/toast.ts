/**
 * Toasts stay imperative rather than becoming a component: they are fired from
 * plain functions (API error handlers, the cart module) as well as from React,
 * and the `.toast-container` / `.toast` styling already exists in style.css.
 */
export type ToastType = '' | 'success' | 'error';

export function showToast(message: string, type: ToastType = '') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
}

/** Kept so ported page code can keep calling `Toast.show(...)` unchanged. */
export const Toast = { show: showToast };
