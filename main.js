const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const msmc = require("msmc");

const {
  loadClients,
  installClient,
  repairClient,
  deleteClient,
  isClientInstalled,
  launchMinecraft
} = require("./launcher/launch");

let mainWindow = null;
let updateCheckInProgress = false;

function sendToRenderer(channel, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, message);
  }
}

function logUpdate(message) {
  console.log("[auto-update]", message);
  sendToRenderer("launch-log", "[auto-update] " + message);
}

function sendUpdateStatus(message) {
  console.log("[auto-update]", message);
  sendToRenderer("launch-status", message);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 1050,
    minHeight: 720,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#05070d",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile("index.html");
  mainWindow.removeMenu();
}


ipcMain.handle("login-microsoft", async () => {
  const xboxManager = new msmc.XboxManager();
  const token = await xboxManager.launch("electron");

  if (!token || !token.mclc()) {
    throw new Error("Microsoft login failed");
  }

  return token.mclc();
});

ipcMain.handle("select-java", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Java executable",
    properties: ["openFile"],
    filters: [
      { name: "Java", extensions: ["exe"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("select-game-dir", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Game Directory",
    properties: ["openDirectory"]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("open-external", async (e, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) {
    return "Auto update works only after build/install.";
  }

  if (updateCheckInProgress) {
    return "Launcher update check is already running.";
  }

  try {
    updateCheckInProgress = true;
    sendUpdateStatus("Checking for launcher updates...");
    logUpdate("Manual launcher update check started.");
    await autoUpdater.checkForUpdatesAndNotify();
    return "Checking for launcher updates...";
  } catch (err) {
    updateCheckInProgress = false;
    const message = err && err.message ? err.message : String(err);
    sendUpdateStatus("Launcher update error: " + message);
    logUpdate("Launcher update error: " + message);
    return "Launcher update error: " + message;
  }
});

ipcMain.handle("load-clients", async () => {
  return await loadClients();
});

ipcMain.handle("check-client", async (e, data) => {
  const clientId = typeof data === "string" ? data : data.client;
  const gameDir = typeof data === "string" ? null : data.gameDir;

  if (!clientId || clientId.trim() === "") {
    return false;
  }

  return await isClientInstalled(clientId, gameDir);
});

ipcMain.handle("install-client", async (e, data) => {
  const clientId = typeof data === "string" ? data : data.client;
  const gameDir = typeof data === "string" ? null : data.gameDir;

  if (!clientId || clientId.trim() === "") {
    throw new Error("No client selected");
  }

  return await installClient(
    clientId,
    msg => e.sender.send("launch-log", msg),
    percent => e.sender.send("download-progress", percent),
    gameDir
  );
});

ipcMain.handle("repair-client", async (e, data) => {
  return await repairClient(
    data.client,
    msg => e.sender.send("launch-log", msg),
    percent => e.sender.send("download-progress", percent),
    data.gameDir
  );
});

ipcMain.handle("delete-client", async (e, data) => {
  return await deleteClient(
    data.client,
    data.gameDir,
    msg => e.sender.send("launch-log", msg)
  );
});

ipcMain.on("launch-game", async (event, data) => {
  try {
    event.reply("launch-status", "Checking client...");

    if (!(await isClientInstalled(data.client, data.gameDir))) {
      event.reply("launch-status", "Installing client...");
      await installClient(
        data.client,
        msg => event.reply("launch-log", msg),
        percent => event.reply("download-progress", percent),
        data.gameDir
      );
    }

    event.reply("launch-status", "Launching Minecraft...");

    await launchMinecraft(
      data,
      msg => event.reply("launch-log", msg),
      code => {
        event.reply("minecraft-closed", code);

        if (code !== 0) {
          event.reply("launch-status", "Minecraft crashed. Exit code: " + code);
        } else {
          event.reply("launch-status", "Minecraft closed.");
        }
      }
    );

    event.reply("launch-status", "Minecraft started.");

    if (data.closeAfterLaunch && mainWindow) {
      setTimeout(() => {
        mainWindow.close();
      }, 1500);
    }
  } catch (err) {
    event.reply("launch-status", "Error: " + err.message);
    event.reply("launch-log", err.stack || err.message);
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
