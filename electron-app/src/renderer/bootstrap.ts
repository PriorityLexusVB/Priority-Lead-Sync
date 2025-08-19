const app = document.getElementById('app')!;
app.textContent = 'Ready ✅';

declare global {
  interface Window {
    leadSync?: { ping?: () => string };
  }
}

try {
  const pong = window.leadSync?.ping?.();
  console.log('[renderer] preload ping →', pong);
} catch (e) {
  console.warn('[renderer] preload ping failed:', e);
}
