const KEY = 'leadsync-last-seen';

export function saveLastSeen(id: string) {
  const list = load();
  if (!list.includes(id)) list.unshift(id);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
}

export function wasSeen(id: string): boolean {
  return load().includes(id);
}

function load(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}
