import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('leadSync', {
  ping: () => 'pong',
  /**
   * Post JSON via the main process (electron.net). Avoids CORS.
   */
  postJson: async (url: string, headers: Record<string, string> = {}, payload: any = {}) => {
    return ipcRenderer.invoke('http:post-json', { url, headers, body: payload });
  },
});
