const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
const RPC = require("discord-rpc");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
autoUpdater.logger = log;
log.transports.file.level = "info";

const clientId = "1375056220200898590";
const gameURL = "https://furlund.com";

let mainWindow, tray, rpc;
let deepLinkUrl = null;

if (process.platform !== "darwin") {
  const deeplinkArg = process.argv.find((arg) => arg.startsWith("furlund://"));
  if (deeplinkArg) {
    deepLinkUrl = deeplinkArg;
  }
}

app.setAppUserModelId("Furlund");

function createWindow(version) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: `Furlund v${version}`,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
    icon: path.join(__dirname, "furlund-icon.png"),
  });

  mainWindow.loadURL(gameURL);

  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require("electron");
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(`Furlund v${version}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupDiscordRPC() {
  rpc = new RPC.Client({ transport: "ipc" });
  rpc.on("ready", () => {
    rpc.setActivity({
      details: "Caring for their cat",
      state: "Playing Solo",
      largeImageKey: "default",
      largeImageText: "Furlund: Adventure, Magic, and Cats",
      partySize: 1,
      partyMax: 5,
      buttons: [{ label: "Adopt Your Own Cat", url: gameURL }],
    });
  });

  rpc.login({ clientId }).catch(console.error);
}

function setupTray() {
  tray = new Tray(path.join(__dirname, "icon.png"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Game",
      click: () => {
        if (!mainWindow) createWindow();
      },
    },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setToolTip("Game Companion");
  tray.setContextMenu(contextMenu);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith("furlund://"));
    if (deepLink) {
      console.log("Deep link from second instance:", deepLink);
      const token = new URL(deepLink).searchParams.get("token");
      if (mainWindow) {
        mainWindow.webContents.send("auth-token", token);
      }
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    console.log("Deep link on macOS:", url);
    const token = new URL(url).searchParams.get("token");
    if (mainWindow) {
      mainWindow.webContents.send("auth-token", token);
    } else {
      deepLinkUrl = url;
    }
  });

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient("furlund");
    const version = app.getVersion();
    createWindow(version);
    autoUpdater.checkForUpdatesAndNotify();
    setupDiscordRPC();
    setupTray();

    if (deepLinkUrl) {
      const token = new URL(deepLinkUrl).searchParams.get("token");
      mainWindow.webContents.once("did-finish-load", () => {
        mainWindow.webContents.send("auth-token", token);
      });
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    if (rpc) rpc.destroy();
  });
}
