const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const msmc = require("msmc");
const crypto = require("crypto");
const DiscordRPC = require("discord-rpc");
const { ensureJava } = require("./javaManager");

const {
  loadClients,
  installClient,
  repairClient,
  deleteClient,
  isClientInstalled,
  launchMinecraft
} = require("./launcher/launch");

// ============================================================
// DISCORD RPC
// ============================================================

const clientId = "1531696999076855818";
DiscordRPC.register(clientId);

const rpc = new DiscordRPC.Client({ transport: "ipc" });
const startTimestamp = new Date();

async function setActivity(details, state) {
  try {
    await rpc.setActivity({
      details,
      state,
      startTimestamp,
      largeImageKey: "aura_logo",
      largeImageText: "Aura Launcher Legacy",
      instance: false
    });
  } catch (error) {
    console.warn("Discord RPC not active:", error.message);
  }
}

rpc.on("ready", () => {
  console.log("Discord RPC connected.");
  setActivity("Browsing Launcher", "Idle");
});

rpc.login({ clientId }).catch((error) => {
  console.warn("Discord RPC unavailable:", error.message);
});

// ============================================================
// WINDOW MANAGEMENT
// ============================================================

let mainWindow = null;
let splashWindow = null;

function createWindow() {
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

  splashWindow.loadFile(path.join(__dirname, "splash.html"));

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 1050,
    minHeight: 720,
    show: false,
    resizable: true,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#05070d",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.removeMenu();

  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }, 1000);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================================================
// JAVA VERSION RESOLVER
// ============================================================

function getRequiredJavaVersion(clientName = "") {
  const name = String(clientName);

  // Minecraft 1.20.5+ and modern releases require Java 21.
  const modernMatch = name.match(/1\.(\d+)(?:\.(\d+))?/);

  if (modernMatch) {
    const minor = Number(modernMatch[1]);
    const patch = Number(modernMatch[2] || 0);

    if (minor > 20 || (minor === 20 && patch >= 5)) {
      return 21;
    }

    if (minor >= 17) {
      return 17;
    }

    return 8;
  }

  // New version naming, e.g. 26.x.
  if (/\b26\./.test(name)) {
    return 25;
  }

  return 8;
}

// ============================================================
// WINDOW CONTROLS
// ============================================================

ipcMain.on("window-minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-maximize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// ============================================================
// OFFLINE UUID
// ============================================================

ipcMain.handle("generate-offline-uuid", (_event, username) => {
  if (
    typeof username !== "string" ||
    !/^[A-Za-z0-9_]{3,16}$/.test(username)
  ) {
    throw new Error(
      "Offline username must contain 3–16 letters, numbers or underscores."
    );
  }

  const hash = crypto
    .createHash("md5")
    .update("OfflinePlayer:" + username)
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
});

// ============================================================
// MICROSOFT AUTHENTICATION
// ============================================================

ipcMain.handle("login-microsoft", async () => {
  try {
    const authManager = new msmc.Auth("select_account");
    const xboxManager = await authManager.launch("raw");
    const token = await xboxManager.getMinecraft();

    if (!token || !token.profile) {
      throw new Error("No Minecraft profile was returned.");
    }

    return {
      id: "ms:" + token.profile.id,
      type: "microsoft",
      name: token.profile.name,
      uuid: token.profile.id,
      accessToken: token.mclc().access_token,
      clientToken: "AuraLauncher",
      avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(
        token.profile.name
      )}/128`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } catch (error) {
    console.error("Microsoft authentication failed:", error);

    throw new Error(
      "Microsoft authentication failed. Check your connection and account, then try again."
    );
  }
});

// ============================================================
// JAVA AND GAME DIRECTORY PICKERS
// ============================================================

ipcMain.handle("select-java", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Java executable",
    properties: ["openFile"],
    filters: [
      { name: "Java executable", extensions: ["exe"] },
      { name: "All files", extensions: ["*"] }
    ]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("select-game-dir", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Minecraft game directory",
    properties: ["openDirectory", "createDirectory"]
  });

  return result.canceled ? null : result.filePaths[0];
});

// ============================================================
// EXTERNAL LINKS
// ============================================================

ipcMain.handle("open-external", async (_event, url) => {
  if (typeof url !== "string") {
    throw new Error("A valid URL is required.");
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The supplied URL is invalid.");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS links can be opened.");
  }

  await shell.openExternal(parsed.toString());
  return true;
});

// ============================================================
// CLIENT MANAGEMENT
// ============================================================

ipcMain.handle("load-clients", async () => {
  return await loadClients();
});

ipcMain.handle("check-client", async (_event, data) => {
  const clientId = typeof data === "string" ? data : data?.client;
  const gameDir = typeof data === "string" ? null : data?.gameDir;

  if (typeof clientId !== "string" || !clientId.trim()) {
    return false;
  }

  return await isClientInstalled(clientId, gameDir);
});

ipcMain.handle("install-client", async (event, data) => {
  const clientId = typeof data === "string" ? data : data?.client;
  const gameDir = typeof data === "string" ? null : data?.gameDir;

  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("No client selected.");
  }

  return await installClient(
    clientId,
    (message) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("launch-log", String(message));
      }
    },
    (percent, downloaded, total, speed, eta) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("download-progress", {
          percent,
          downloaded,
          total,
          speed,
          eta
        });
      }
    },
    gameDir
  );
});

ipcMain.handle("repair-client", async (event, data) => {
  if (!data || typeof data.client !== "string") {
    throw new Error("No client selected for repair.");
  }

  return await repairClient(
    data.client,
    (message) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("launch-log", String(message));
      }
    },
    (percent, downloaded, total, speed, eta) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("download-progress", {
          percent,
          downloaded,
          total,
          speed,
          eta
        });
      }
    },
    data.gameDir
  );
});

ipcMain.handle("delete-client", async (event, data) => {
  if (!data || typeof data.client !== "string") {
    throw new Error("No client selected for deletion.");
  }

  return await deleteClient(
    data.client,
    data.gameDir,
    (message) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("launch-log", String(message));
      }
    }
  );
});

// ============================================================
// MINECRAFT LAUNCHING
// ============================================================

ipcMain.on("launch-game", async (event, data) => {
  const send = (channel, payload) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(channel, payload);
    }
  };

  try {
    if (!data || typeof data.client !== "string") {
      throw new Error("No Minecraft client selected.");
    }

    send("launch-status", "Checking client...");

    if (!data.javaPath || data.javaPath === "java") {
      const requiredVersion = getRequiredJavaVersion(data.client);

      send(
        "launch-status",
        `Verifying Java ${requiredVersion} runtime...`
      );

      send(
        "launch-log",
        `Client requires Java ${requiredVersion}. Checking runtime...`
      );

      const managedJavaPath = await ensureJava(
        requiredVersion,
        data.gameDir,
        (percent) => {
          send("download-progress", {
            percent: Number(percent) || 0
          });

          send(
            "launch-status",
            `Preparing Java ${requiredVersion}...`
          );
        }
      );

      data.javaPath = managedJavaPath;
      send("launch-log", `Using Java runtime: ${managedJavaPath}`);
    }

    const installed = await isClientInstalled(
      data.client,
      data.gameDir
    );

    if (!installed) {
      send("launch-status", "Installing client...");

      await installClient(
        data.client,
        (message) => send("launch-log", String(message)),
        (percent, downloaded, total, speed, eta) => {
          send("download-progress", {
            percent,
            downloaded,
            total,
            speed,
            eta
          });
        },
        data.gameDir
      );
    }

    send("launch-status", "Launching Minecraft...");
    setActivity(`Loading ${data.client}...`, "Starting Game");

    await launchMinecraft(
      data,
      (message) => send("launch-log", String(message)),
      (exitCode) => {
        send("minecraft-closed", exitCode);

        setActivity("Browsing Launcher", "Idle");

        if (exitCode !== 0) {
          send(
            "launch-status",
            `Minecraft exited with code ${exitCode}.`
          );
        } else {
          send("launch-status", "Minecraft closed.");
        }
      }
    );

    send("launch-status", "Minecraft started.");
    setActivity(`Playing ${data.client}`, "In Game");

    if (data.closeAfterLaunch && mainWindow) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      }, 1500);
    }
  } catch (error) {
    console.error("Minecraft launch failed:", error);

    send("launch-status", "Launch failed. Check the console for details.");
    send(
      "launch-log",
      error && error.stack ? error.stack : String(error)
    );

    setActivity("Browsing Launcher", "Idle");
  }
});

// ============================================================
// AUTO UPDATER
// ============================================================

ipcMain.handle("check-for-updates", async (_event, channel) => {
  if (!app.isPackaged) {
    sendToRenderer(
      "update-status",
      "Automatic updates are available in packaged releases only."
    );

    return {
      skipped: true,
      reason: "development-build"
    };
  }

  autoUpdater.allowPrerelease = channel === "beta";

  try {
    return await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("Manual update check failed:", error);

    sendToRenderer(
      "update-status",
      "Updates are currently unavailable. You can continue using Aura Launcher Legacy."
    );

    return {
      skipped: true,
      reason: "update-check-failed"
    };
  }
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    sendToRenderer("update-status", "Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    sendToRenderer(
      "update-status",
      `Downloading update ${info.version}...`
    );
  });

  autoUpdater.on("update-not-available", () => {
    sendToRenderer("update-status", "Aura Launcher Legacy is up to date.");
  });

  autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("update-progress", progress.percent);
  });

  autoUpdater.on("update-downloaded", () => {
    sendToRenderer(
      "update-status",
      "Update ready. Restarting launcher..."
    );

    setTimeout(() => {
      if (app.isPackaged) {
        autoUpdater.quitAndInstall();
      }
    }, 3000);
  });

  autoUpdater.on("error", (error) => {
    // Detailed diagnostics stay in the developer console.
    // Do not expose HTTP response headers in the sidebar.
    console.error("Aura Launcher Legacy updater error:", error);

    sendToRenderer(
      "update-status",
      "Updates unavailable. You can continue using Aura Launcher Legacy."
    );
  });
}

function sendToRenderer(channel, data) {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.webContents &&
    !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send(channel, data);
  }
}

// ============================================================
// APP STARTUP
// ============================================================

app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();

  // Never request latest.yml while running `npm start`.
  // Packaged releases still require a valid release feed.
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn(
        "Automatic update check failed:",
        error.message
      );
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    rpc.destroy();
  } catch {
    // Discord may not have been connected.
  }
});