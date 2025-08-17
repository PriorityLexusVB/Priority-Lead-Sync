import { subscribeToLeads } from './firestore';
import { saveLastSeen, wasSeen } from './store';

declare global {
  interface Window {
    leadSync: { notify: (t: string, b: string) => void; openLeads: () => void };
  }
}

function render(doc: any) {
  const container = document.querySelector('#leads');
  if (!container) return;
  const item = document.createElement('div');
  item.className = 'lead';
  const title = doc?.customer?.name || doc?.subject || 'New Lead';
  const sub = [doc?.vehicle?.year, doc?.vehicle?.make, doc?.vehicle?.model].filter(Boolean).join(' ');
  item.innerHTML = `<div class="title">${title}</div><div class="sub">${sub || ''}</div>`;
  container.prepend(item);
}

subscribeToLeads((doc) => {
  if (wasSeen(doc.id)) return;
  saveLastSeen(doc.id);

  const title = doc?.customer?.name || doc?.subject || 'New Lead';
  const sub = [doc?.vehicle?.year, doc?.vehicle?.make, doc?.vehicle?.model].filter(Boolean).join(' ');
  window.leadSync?.notify(title, sub || 'New web lead received');
  render(doc);
});
