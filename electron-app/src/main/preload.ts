import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("leadSync", {
  postJson: async (url: string, body: any, headers: Record<string,string> = {}) =>
    await ipcRenderer.invoke("http:post-json", url, body, headers),
});
