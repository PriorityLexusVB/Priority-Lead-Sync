import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('leadSync', {
  ping: () => 'pong'
});
