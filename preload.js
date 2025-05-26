const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onAuthToken: (callback) =>
    ipcRenderer.on("auth-token", (event, token) => callback(token)),
});
