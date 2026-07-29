const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const msmc = require("msmc");
const crypto = require("crypto");
const DiscordRPC = require("discord-rpc");
const { ensureJava } = require("./javaManager"); // NEW: Automated Java Manager

const {
  loadClients,
  installClient,
  repairClient,
  deleteClient,
  isClientInstalled,
  launchMinecraft
} = require("./launcher/launch");

// --- DISCORD RPC SETUP ---
const clientId = "1531696999076855818";
DiscordRPC.register(clientId);
const rpc = new DiscordRPC.Client({ transport: "ipc" });
const startTimestamp = new Date();

async function setActivity(details, state) {
  if (!rpc) return;
  try {
    await rpc.setActivity({
      details: details,
      state: state,
      startTimestamp,
      largeImageKey: "aura_logo",
      largeImageText: "Aura Launcher Beta",
      instance: false,
    });
  } catch (err) {
    console.warn("Discord RPC not active:", err.message);
  }
}

rpc.on("ready", () => {
  console.log("Discord RPC connected!");
  setActivity("Browsing Launcher", "Idle");
});

// We catch errors so the launcher doesn't crash if Discord is closed
rpc.login({ clientId }).catch(console.warn);

// --- APP SETUP ---
let mainWindow = null;
let splashWindow = null;

function createWindow() {
  // 1. Create Splash Window
  splashWindow = new BrowserWindow({
    width: 320,
    height: 420,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  splashWindow.loadFile("splash.html");

  // 2. Create Main Application Window (Hidden initially)
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 1050,
    minHeight: 720,
    show: false,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: "#05070d",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile("index.html");
  mainWindow.removeMenu();

  // 3. Swap windows when main window is ready
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      mainWindow.show();
      mainWindow.focus();
    }, 1500); 
  });
}

// --- JAVA VERSION RESOLVER ---
function getRequiredJavaVersion(clientName) {
  const match = clientName.match(/1\.(\d+)(\.\d+)?/);
  if (match) {
    const minor = parseFloat(match[1] + (match[2] || ""));
    if (minor >= 20.5) return 21; // 1.20.5+ requires Java 21
    if (minor >= 17) return 17;   // 1.17 to 1.20.4 requires Java 17
  }
  return 8; // 1.16.5 and below default to Java 8
}

// --- WINDOW CONTROLS ---
ipcMain.on("window-minimize", () => { if(mainWindow) mainWindow.minimize(); });
ipcMain.on("window-maximize", () => { 
  if(mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); 
});
ipcMain.on("window-close", () => { if(mainWindow) mainWindow.close(); });

// --- OFFLINE UUID GENERATOR ---
ipcMain.handle("generate-offline-uuid", (event, username) => {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + username).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
});

// --- MICROSOFT AUTHENTICATION ---
ipcMain.handle("login-microsoft", async () => {
  try {
    const authManager = new msmc.Auth("select_account");
    const xboxManager = await authManager.launch("raw");
    const token = await xboxManager.getMinecraft();

    return {
      id: "ms:" + token.profile.id,
      type: "microsoft",
      name: token.profile.name,
      uuid: token.profile.id,
      accessToken: token.mclc().access_token,
      clientToken: "AuraLauncher",
      avatarUrl: `https://mc-heads.net/avatar/${token.profile.name}/128`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } catch (err) {
    throw new Error("Microsoft Authentication Failed: " + err.message);
  }
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

ipcMain.handle("open-external", async (event, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("load-clients", async () => {
  return await loadClients();
});

ipcMain.handle("check-client", async (event, data) => {
  const clientId = typeof data === "string" ? data : data.client;
  const gameDir = typeof data === "string" ? null : data.gameDir;
  if (!clientId || clientId.trim() === "") return false;
  return await isClientInstalled(clientId, gameDir);
});

ipcMain.handle("install-client", async (event, data) => {
  const clientId = typeof data === "string" ? data : data.client;
  const gameDir = typeof data === "string" ? null : data.gameDir;
  if (!clientId || clientId.trim() === "") throw new Error("No client selected");
  return await installClient(
    clientId,
    msg => event.sender.send("launch-log", msg),
    (percent, downloaded, total, speed, eta) => {
      event.sender.send("download-progress", { percent, downloaded, total, speed, eta });
    },
    gameDir
  );
});

ipcMain.handle("repair-client", async (event, data) => {
  return await repairClient(
    data.client,
    msg => event.sender.send("launch-log", msg),
    (percent, downloaded, total, speed, eta) => {
      event.sender.send("download-progress", { percent, downloaded, total, speed, eta });
    },
    data.gameDir
  );
});

ipcMain.handle("delete-client", async (event, data) => {
  return await deleteClient(data.client, data.gameDir, msg => event.sender.send("launch-log", msg));
});

// --- GAME LAUNCH HANDLER ---
ipcMain.on("launch-game", async (event, data) => {
  try {
    event.reply("launch-status", "Checking client...");

    // AUTOMATED JAVA MANAGEMENT
    if (!data.javaPath || data.javaPath === "java") {
      const reqVersion = getRequiredJavaVersion(data.client);
      event.reply("launch-status", `Verifying Java ${reqVersion} runtime...`);
      event.reply("launch-log", `Client requires Java ${reqVersion}. Setting up runtime...`);

      const managedJavaPath = await ensureJava(reqVersion, data.gameDir, (percent) => {
        event.reply("download-progress", percent);
        event.reply("launch-status", `Downloading Java ${reqVersion}...`);
      });
      
      data.javaPath = managedJavaPath;
      event.reply("launch-log", `Using managed Java runtime: ${managedJavaPath}`);
    }

    if (!(await isClientInstalled(data.client, data.gameDir))) {
      event.reply("launch-status", "Installing client...");
      await installClient(
        data.client,
        msg => event.reply("launch-log", msg),
        (percent, downloaded, total, speed, eta) => {
          event.reply("download-progress", { percent, downloaded, total, speed, eta });
        },
        data.gameDir
      );
    }

    event.reply("launch-status", "Launching Minecraft...");
    setActivity(`Loading ${data.client}...`, "Starting Game");

    await launchMinecraft(
      data,
      msg => event.reply("launch-log", msg),
      code => {
        event.reply("minecraft-closed", code);
        setActivity("Browsing Launcher", "Idle");
        
        if (code !== 0) {
          event.reply("launch-status", "Minecraft crashed. Exit code: " + code);
        } else {
          event.reply("launch-status", "Minecraft closed.");
        }
      }
    );

    event.reply("launch-status", "Minecraft started.");
    setActivity(`Playing ${data.client}`, "In Game");

    if (data.closeAfterLaunch && mainWindow) {
      setTimeout(() => mainWindow.close(), 1500);
    }
  } catch (err) {
    event.reply("launch-status", "Error: " + err.message);
    event.reply("launch-log", err.stack || err.message);
    setActivity("Browsing Launcher", "Idle");
  }
});

// --- AUTO UPDATER ---
ipcMain.handle("check-for-updates", async (event, channel) => {
  autoUpdater.allowPrerelease = (channel === "beta");
  return await autoUpdater.checkForUpdates();
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.on("checking-for-update", () => sendToRenderer("update-status", "Checking for updates..."));
  autoUpdater.on("update-available", info => sendToRenderer("update-status", "Downloading update " + info.version));
  autoUpdater.on("update-not-available", () => sendToRenderer("update-status", "Update not available."));
  autoUpdater.on("download-progress", progress => sendToRenderer("update-progress", progress.percent));
  autoUpdater.on("update-downloaded", () => {
    sendToRenderer("update-status", "Update ready. Restarting...");
    setTimeout(() => autoUpdater.quitAndInstall(), 3000);
  });
  autoUpdater.on("error", err => sendToRenderer("update-status", "Update error: " + err.message));
}

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}