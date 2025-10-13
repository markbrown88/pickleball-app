/**
 * Toast utility for consistent success/error messaging
 * Uses the existing CSS classes for styling
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  duration?: number;
  persistent?: boolean;
}

/**
 * Shows a toast message using the existing CSS classes
 */
export const showToast = (message: string, type: ToastType = 'success', options: ToastOptions = {}) => {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');
  
  // Add message content
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">
        ${getToastIcon(type)}
      </div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" aria-label="Close">×</button>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(toast);

  // Add close functionality
  const closeButton = toast.querySelector('.toast-close');
  const closeToast = () => {
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  closeButton?.addEventListener('click', closeToast);

  // Auto-remove after duration (default 5 seconds)
  if (!options.persistent) {
    setTimeout(closeToast, options.duration || 5000);
  }

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('toast-enter');
  });
};

/**
 * Get icon for toast type
 */
const getToastIcon = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>';
    case 'error':
      return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    case 'warning':
      return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" /></svg>';
    case 'info':
      return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
    default:
      return '';
  }
};

/**
 * Convenience functions
 */
export const showSuccess = (message: string, options?: ToastOptions) => 
  showToast(message, 'success', options);

export const showError = (message: string, options?: ToastOptions) => 
  showToast(message, 'error', options);

export const showInfo = (message: string, options?: ToastOptions) => 
  showToast(message, 'info', options);

export const showWarning = (message: string, options?: ToastOptions) => 
  showToast(message, 'warning', options);
