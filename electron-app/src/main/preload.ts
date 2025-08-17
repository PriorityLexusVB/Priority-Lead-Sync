import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('leadSync', {
  notify: (title: string, body: string) => ipcRenderer.invoke('notify', { title, body }),
  openLeads: () => ipcRenderer.invoke('open-leads')
});
