// =============================================
// TOAST NOTIFICATIONS
// =============================================

/**
 * Exibe notificação toast
 * @param {string} msg - Mensagem a exibir
 * @param {'success'|'error'|'info'} [type=''] - Tipo do toast
 */
export function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const last = container.lastElementChild;
  if (last && last.dataset.msg === msg) {
    last.classList.remove('show');
    void last.offsetWidth;
    last.classList.add('show');
    return;
  }
  while (container.children.length >= 3) {
    const oldest = container.firstElementChild;
    oldest.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.dataset.msg = msg;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icons[type] || '💬';
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  toast.appendChild(iconSpan);
  toast.appendChild(document.createTextNode(' '));
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  // Auto-dismiss with pause on hover
  let dismissTimeout;
  const scheduleDismiss = () => {
    dismissTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  const cancelDismiss = () => {
    if (dismissTimeout) clearTimeout(dismissTimeout);
  };

  toast.addEventListener('mouseenter', cancelDismiss);
  toast.addEventListener('mouseleave', scheduleDismiss);
  toast.addEventListener('click', () => toast.remove());

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  scheduleDismiss();
}
