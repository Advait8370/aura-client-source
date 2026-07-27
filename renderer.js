window.onerror = function(message, url, line) {
  console.error("JS ERROR:", message, "Line:", line);
  alert("JS ERROR: " + message + " Line: " + line);
};

// --- SECURE WINDOW CONTROLS ---
const minBtn = document.getElementById('minimize') || document.querySelector('.minimize') || document.querySelector('.titlebar-controls .minimize');
const maxBtn = document.getElementById('maximize') || document.querySelector('.maximize') || document.querySelector('.titlebar-controls .maximize');
const closeBtn = document.getElementById('close') || document.querySelector('.close') || document.querySelector('.titlebar-controls .close');

if (minBtn) {
    minBtn.addEventListener('click', () => {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.send('window-minimize');
        }
    });
}

if (maxBtn) {
    maxBtn.addEventListener('click', () => {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.send('window-maximize');
        }
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.send('window-close');
        }
    });
}

// --- DOM ELEMENTS ---
const statusText = document.getElementById("status");
const consoleBox = document.getElementById("console");
const accountName = document.getElementById("accountName");
const accountType = document.getElementById("accountType");
const accountSelect = document.getElementById("accountSelect");
const accountAvatarLarge = document.getElementById("accountAvatarLarge");
const accountNameLarge = document.getElementById("accountNameLarge");
const currentAccountStatus = document.getElementById("currentAccountStatus");
const accountUuid = document.getElementById("accountUuid");
const accountStatusIndicator = document.getElementById("accountStatusIndicator");

const clientSelect = document.getElementById("client");
const clientManagerSelect = document.getElementById("clientManagerSelect");
const installState = document.getElementById("installState");
const managerState = document.getElementById("managerState");
const downloadProgress = document.getElementById("downloadProgress");
const downloadPercent = document.getElementById("downloadPercent");
const managerProgress = document.getElementById("managerProgress");
const managerPercent = document.getElementById("managerPercent");

const logModal = document.getElementById("logModal");
const launchLog = document.getElementById("launchLog");
const logStatus = document.getElementById("logStatus");
const crashModal = document.getElementById("crashModal");
const crashText = document.getElementById("crashText");
const crashLog = document.getElementById("crashLog");

const javaPathInput = document.getElementById("javaPathInput");
const gameDirInput = document.getElementById("gameDirInput");
const closeAfterLaunchInput = document.getElementById("closeAfterLaunch");
const skinAvatar = document.getElementById("skinAvatar");
const defaultAvatar = document.getElementById("defaultAvatar");
const skinPreview = document.getElementById("skinPreview");
const skinName = document.getElementById("skinName");
const skinHelp = document.getElementById("skinHelp");

// Update Modal Elements
const updateModal = document.getElementById("updateModal");
const updateStatusText = document.getElementById("updateStatusText");
const updateProgressBar = document.getElementById("updateProgressBar");
const updateProgressText = document.getElementById("updateProgressText");

// --- STATE ---
let clientsCache = [];
let currentAccount = readCurrentAccount();
let settings = JSON.parse(localStorage.getItem("auraSettings") || "{}");
let javaPath = settings.javaPath || "java";
let gameDir = settings.gameDir || "";
let closeAfterLaunch = settings.closeAfterLaunch || false;

// --- ACCOUNT LOGIC ---
function readAccounts() {
  return JSON.parse(localStorage.getItem("auraAccounts") || "[]");
}

function writeAccounts(accounts) {
  localStorage.setItem("auraAccounts", JSON.stringify(accounts));
}

function readCurrentAccount() {
  return JSON.parse(localStorage.getItem("auraAccount") || "null");
}

function setCurrentAccount(account) {
  currentAccount = account;
  if (account) {
    localStorage.setItem("auraAccount", JSON.stringify(account));
  } else {
    localStorage.removeItem("auraAccount");
  }
  renderAccountUI();
}

function accountLabel(account) {
  if (!account) return "No account";
  if (account.type === "microsoft") return "Microsoft Account";
  return account.type === "ely" ? "Ely.by Account" : "Offline Account";
}

function accountAvatar(account) {
  if (!account) return "";
  return account.avatarUrl || `https://mc-heads.net/avatar/${encodeURIComponent(account.name)}/128`;
}

function normalizeStoredAccounts() {
  const accounts = readAccounts().filter(account => account && account.id && account.name);
  const selected = readCurrentAccount();

  if (selected && !accounts.some(account => account.id === selected.id)) {
    accounts.push(selected);
  }

  writeAccounts(accounts);

  if (!selected && accounts.length > 0) {
    setCurrentAccount(accounts[0]);
  } else {
    currentAccount = selected;
  }
}

function renderAccountUI() {
  const accounts = readAccounts();
  if(accountSelect) accountSelect.innerHTML = "";

  if (accounts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved accounts";
    if(accountSelect) accountSelect.appendChild(option);
  } else {
    accounts.forEach(account => {
      const option = document.createElement("option");
      option.value = account.id;
      let accTypeStr = account.type === "microsoft" ? "Microsoft" : (account.type === "ely" ? "Ely.by" : "Offline");
      option.textContent = `${account.name} · ${accTypeStr}`;
      if(accountSelect) accountSelect.appendChild(option);
    });
  }

  if (currentAccount) {
    if(accountSelect) accountSelect.value = currentAccount.id;
    if(accountName) accountName.innerText = currentAccount.name;
    if(accountType) accountType.innerText = accountLabel(currentAccount);
    if(accountNameLarge) accountNameLarge.innerText = currentAccount.name;
    if(currentAccountStatus) currentAccountStatus.innerText = accountLabel(currentAccount) + " selected";
    if(accountUuid) accountUuid.innerText = "UUID: " + currentAccount.uuid;
    
    if(accountStatusIndicator) {
      accountStatusIndicator.innerText = "Signed in";
      accountStatusIndicator.className = "install-state installed";
    }

    const avatarUrl = accountAvatar(currentAccount);
    if(skinAvatar) {
      skinAvatar.src = avatarUrl;
      skinAvatar.style.display = "block";
    }
    if(defaultAvatar) defaultAvatar.style.display = "none";
    if(accountAvatarLarge) {
      accountAvatarLarge.src = avatarUrl;
      accountAvatarLarge.style.display = "block";
    }
  } else {
    if(accountName) accountName.innerText = "Not logged in";
    if(accountType) accountType.innerText = "Add an account";
    if(accountNameLarge) accountNameLarge.innerText = "Not logged in";
    if(currentAccountStatus) currentAccountStatus.innerText = "No account selected";
    if(accountUuid) accountUuid.innerText = "UUID unavailable";
    
    if(accountStatusIndicator) {
      accountStatusIndicator.innerText = "Signed out";
      accountStatusIndicator.className = "install-state missing";
    }
    
    if(skinAvatar) skinAvatar.style.display = "none";
    if(defaultAvatar) defaultAvatar.style.display = "grid";
    if(accountAvatarLarge) accountAvatarLarge.style.display = "none";
  }

  updateSkinUI();
}

// --- UI NAVIGATION ---
function showPage(page, btn) {
  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active-page");
  });

  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active-page");

  document.querySelectorAll(".side-btn").forEach(button => {
    button.classList.remove("active");
  });

  if (btn) {
    btn.classList.add("active");
  } else {
    const buttons = Array.from(document.querySelectorAll(".side-btn"));
    const activeButton = buttons.find(button => button.textContent.trim().toLowerCase().includes(page));
    if (activeButton) activeButton.classList.add("active");
  }

  if (page === "clients") checkManagerClient();
  if (page === "account") renderAccountUI();
  if (page === "skins") updateSkinUI();
}

function openLoginPage() {
  window.location.href = "login.html";
}

function switchAccount(accountId) {
  const account = readAccounts().find(saved => saved.id === accountId);
  if (!account) return;
  setCurrentAccount(account);
  if(statusText) statusText.innerText = "Switched to " + account.name;
}

function logoutAccount() {
  setCurrentAccount(null);
  if(statusText) statusText.innerText = "Logged out";
}

function deleteCurrentAccount() {
  if (!currentAccount) {
    if(statusText) statusText.innerText = "No account selected";
    return;
  }

  const ok = confirm("Delete account " + currentAccount.name + "?");
  if (!ok) return;

  const accounts = readAccounts().filter(account => account.id !== currentAccount.id);
  writeAccounts(accounts);
  setCurrentAccount(accounts[0] || null);
  if(statusText) statusText.innerText = "Account deleted";
}

// --- SETTINGS ---
function saveSettings() {
  settings = {
    ram: document.getElementById("ram").value,
    javaPath,
    gameDir,
    closeAfterLaunch: closeAfterLaunchInput.checked
  };

  closeAfterLaunch = settings.closeAfterLaunch;
  localStorage.setItem("auraSettings", JSON.stringify(settings));
  if(statusText) statusText.innerText = "Settings saved";
}

function loadSettings() {
  const ramSelect = document.getElementById("ram");
  const themeSelect = document.getElementById("theme");
  const accentSelect = document.getElementById("accentColor");
  const savedTheme = localStorage.getItem("auraTheme") || "dark";
  const savedAccent = localStorage.getItem("auraAccent") || "#22c55e";

  document.body.dataset.theme = savedTheme;
  document.documentElement.style.setProperty("--accent", savedAccent);

  if (ramSelect) ramSelect.value = settings.ram || "2";
  if (themeSelect) themeSelect.value = savedTheme;
  if (accentSelect) accentSelect.value = savedAccent;
  if (javaPathInput) javaPathInput.value = javaPath === "java" ? "" : javaPath;
  if (gameDirInput) gameDirInput.value = gameDir || "";
  if (closeAfterLaunchInput) closeAfterLaunchInput.checked = closeAfterLaunch;
}

// --- CLIENT LOGIC ---
async function loadClients() {
  try {
    clientsCache = await window.electron.ipcRenderer.invoke("load-clients");
    if(clientSelect) clientSelect.innerHTML = "";
    if(clientManagerSelect) clientManagerSelect.innerHTML = "";

    clientsCache.forEach(client => {
      const launchOption = document.createElement("option");
      launchOption.value = client.id;
      launchOption.textContent = client.name;
      if(clientSelect) clientSelect.appendChild(launchOption);

      const managerOption = document.createElement("option");
      managerOption.value = client.id;
      managerOption.textContent = client.name;
      if(clientManagerSelect) clientManagerSelect.appendChild(managerOption);
    });

    if (clientsCache.length > 0) {
      if(clientSelect) clientSelect.value = clientsCache[0].id;
      if(clientManagerSelect) clientManagerSelect.value = clientsCache[0].id;
    }

    await checkSelectedClient();
    await checkManagerClient();
  } catch (err) {
    if(statusText) statusText.innerText = "Failed to load clients";
    console.error(err);
    if(consoleBox) consoleBox.value += err.message + "\n";
  }
}

function updateSkinUI() {
  if (!currentAccount) {
    if(skinPreview) skinPreview.style.display = "none";
    if(skinName) skinName.innerText = "Not logged in";
    if(skinHelp) skinHelp.innerText = "Login with Microsoft or Ely.by to show your skin.";
    return;
  }

  if(skinName) skinName.innerText = currentAccount.name;

  if (currentAccount.type === "offline") {
    if(skinPreview) skinPreview.style.display = "none";
    if(skinHelp) skinHelp.innerText = "Offline accounts do not include skin sync.";
    return;
  }

  if (currentAccount.type === "microsoft") {
     if(skinPreview) skinPreview.src = `https://minotar.net/armor/body/${encodeURIComponent(currentAccount.name)}/160.png`;
     if(skinHelp) skinHelp.innerText = "Microsoft skin preview";
  } else {
     if(skinPreview) skinPreview.src = `https://skinsystem.ely.by/skins/${encodeURIComponent(currentAccount.name)}`;
     if(skinHelp) skinHelp.innerText = "Ely.by skin preview";
  }
  if(skinPreview) skinPreview.style.display = "block";
}

async function openElySkins() {
  await window.electron.ipcRenderer.invoke("open-external", "https://ely.by/skins");
}

async function selectJava() {
  const selected = await window.electron.ipcRenderer.invoke("select-java");
  if (selected) {
    javaPath = selected;
    if(javaPathInput) javaPathInput.value = selected;
    saveSettings();
    if(statusText) statusText.innerText = "Java selected";
  }
}

async function selectGameDir() {
  const selected = await window.electron.ipcRenderer.invoke("select-game-dir");
  if (selected) {
    gameDir = selected;
    if(gameDirInput) gameDirInput.value = selected;
    saveSettings();
    await checkSelectedClient();
    await checkManagerClient();
    if(statusText) statusText.innerText = "Game directory selected";
  }
}

async function checkSelectedClient() {
  if (!clientSelect || !clientSelect.value) return;
  try {
    const installed = await window.electron.ipcRenderer.invoke("check-client", {
      client: clientSelect.value,
      gameDir
    });

    if (installed) {
      if(installState) installState.innerText = "Installed";
      if(installState) installState.className = "install-state installed";
    } else {
      if(installState) installState.innerText = "Not installed";
      if(installState) installState.className = "install-state missing";
    }
  } catch (err) {
    console.error(err);
  }
}

async function checkManagerClient() {
  if (!clientManagerSelect || !clientManagerSelect.value) return;
  try {
    const installed = await window.electron.ipcRenderer.invoke("check-client", {
      client: clientManagerSelect.value,
      gameDir
    });

    if (installed) {
      if(managerState) managerState.innerText = "Installed";
      if(managerState) managerState.className = "install-state installed";
    } else {
      if(managerState) managerState.innerText = "Not installed";
      if(managerState) managerState.className = "install-state missing";
    }
  } catch (err) {
    console.error(err);
  }
}

function syncClientSelect() {
  if(clientSelect && clientManagerSelect) clientSelect.value = clientManagerSelect.value;
  checkSelectedClient();
  checkManagerClient();
}

function resetProgress() {
  if(downloadProgress) downloadProgress.style.width = "0%";
  if(downloadPercent) downloadPercent.innerText = "0%";
  if(managerProgress) managerProgress.style.width = "0%";
  if(managerPercent) managerPercent.innerText = "0%";
}

async function repairSelectedClient() {
  if (!clientManagerSelect || !clientManagerSelect.value) return;

  resetProgress();
  if(consoleBox) consoleBox.value = "";
  if(launchLog) launchLog.value = "";
  if(logModal) logModal.classList.remove("hidden");
  if(logStatus) logStatus.innerText = "Repairing client...";

  try {
    await window.electron.ipcRenderer.invoke("repair-client", {
      client: clientManagerSelect.value,
      gameDir
    });

    if(logStatus) logStatus.innerText = "Repair complete";
    await checkSelectedClient();
    await checkManagerClient();
    setTimeout(() => { if(logModal) logModal.classList.add("hidden") }, 1200);
  } catch (err) {
    if(logStatus) logStatus.innerText = "Repair failed";
    if(consoleBox) consoleBox.value += err.message + "\n";
    if(launchLog) launchLog.value += err.message + "\n";
  }
}

async function deleteSelectedClient() {
  if (!clientManagerSelect || !clientManagerSelect.value) return;
  const ok = confirm("Delete selected client?");
  if (!ok) return;

  resetProgress();
  if(consoleBox) consoleBox.value = "";
  if(launchLog) launchLog.value = "";

  try {
    await window.electron.ipcRenderer.invoke("delete-client", {
      client: clientManagerSelect.value,
      gameDir
    });

    if(statusText) statusText.innerText = "Client deleted";
    await checkSelectedClient();
    await checkManagerClient();
  } catch (err) {
    if(statusText) statusText.innerText = "Delete failed";
    if(consoleBox) consoleBox.value += err.message + "\n";
  }
}

async function play() {
  const clientId = clientSelect ? clientSelect.value : null;

  if (!clientId) {
    alert("No client selected.");
    return;
  }

  if (!currentAccount) {
    if(statusText) statusText.innerText = "Login first";
    alert("Please add or select an account first.");
    showPage("account");
    return;
  }

  resetProgress();
  if(consoleBox) consoleBox.value = "";
  if(launchLog) launchLog.value = "";
  if(crashLog) crashLog.value = "";
  if(logModal) logModal.classList.remove("hidden");

  try {
    if(logStatus) logStatus.innerText = "Checking client...";
    if(statusText) statusText.innerText = "Checking client...";

    const installed = await window.electron.ipcRenderer.invoke("check-client", {
      client: clientId,
      gameDir
    });

    if (!installed) {
      if(logStatus) logStatus.innerText = "Downloading client...";
      if(statusText) statusText.innerText = "Downloading client...";

      await window.electron.ipcRenderer.invoke("install-client", {
        client: clientId,
        gameDir
      });

      await checkSelectedClient();
      await checkManagerClient();
    }

    if(logStatus) logStatus.innerText = "Launching Minecraft...";
    if(statusText) statusText.innerText = "Launching Minecraft...";

    window.electron.ipcRenderer.send("launch-game", {
      client: clientId,
      accountType: currentAccount.type,
      username: currentAccount.name,
      uuid: currentAccount.uuid,
      accessToken: currentAccount.accessToken,
      clientToken: currentAccount.clientToken,
      ram: document.getElementById("ram") ? document.getElementById("ram").value : "2",
      javaPath,
      gameDir,
      closeAfterLaunch: closeAfterLaunchInput ? closeAfterLaunchInput.checked : false
    });
  } catch (err) {
    if(logStatus) logStatus.innerText = "Error";
    if(statusText) statusText.innerText = "Error: " + err.message;
    if(consoleBox) consoleBox.value += err.message + "\n";
    if(launchLog) launchLog.value += err.message + "\n";
    console.error(err);
  }
}

function closeLogModal() {
  if(logModal) logModal.classList.add("hidden");
  if(statusText) statusText.innerText = "Launcher running";
}

function closeCrashModal() {
  if(crashModal) crashModal.classList.add("hidden");
}

function changeTheme() {
  const theme = document.getElementById("theme").value;
  document.body.dataset.theme = theme;
  localStorage.setItem("auraTheme", theme);
}

function changeAccent() {
  const colour = document.getElementById("accentColor").value;
  document.documentElement.style.setProperty("--accent", colour);
  localStorage.setItem("auraAccent", colour);
}

async function checkForUpdates() {
  if(statusText) statusText.innerText = "Checking for updates...";
  await window.electron.ipcRenderer.invoke("check-for-updates");
}

// --- IPC LISTENERS ---
window.electron.ipcRenderer.on("download-progress", (data) => {
  const payload = typeof data === "number" ? { percent: data } : data;
  const percent = Math.round(Number(payload.percent) || 0);

  if(downloadProgress) downloadProgress.style.width = percent + "%";
  if(managerProgress) managerProgress.style.width = percent + "%";
  if(downloadPercent) downloadPercent.innerText = `${percent}% • ${payload.speed?.toFixed(2) || 0} MB/s`;
  if(managerPercent) managerPercent.innerText = `${percent}% • ETA ${Math.round(payload.eta || 0)}s`;
});

window.electron.ipcRenderer.on("launch-status", (message) => {
  if(statusText) statusText.innerText = message;
  if(logStatus) logStatus.innerText = message;

  if (message === "Minecraft started.") {
    setTimeout(() => { if(logModal) logModal.classList.add("hidden") }, 1500);
  }
});

window.electron.ipcRenderer.on("launch-log", (message) => {
  if(consoleBox) {
    consoleBox.value += message + "\n";
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }
  if(launchLog) {
    launchLog.value += message + "\n";
    launchLog.scrollTop = launchLog.scrollHeight;
  }
  if(crashLog) {
    crashLog.value += message + "\n";
    crashLog.scrollTop = crashLog.scrollHeight;
  }
});

window.electron.ipcRenderer.on("minecraft-closed", (code) => {
  if (code !== 0 && crashModal) {
    if(crashText) crashText.innerText = "Exit code: " + code;
    crashModal.classList.remove("hidden");
  }
});

window.electron.ipcRenderer.on("update-status", (message) => {
  if(statusText) statusText.innerText = message;
  
  if (message.includes("Downloading") || message.includes("Checking")) {
    if(updateModal) updateModal.classList.remove("hidden");
    if(updateStatusText) updateStatusText.innerText = message;
  }
  
  if (message.includes("Update ready")) {
    if(updateStatusText) updateStatusText.innerText = "Update ready. Restarting launcher...";
  }
  
  if (message.includes("Update error") || message.includes("not available")) {
    setTimeout(() => {
      if(updateModal) updateModal.classList.add("hidden");
    }, 3000);
  }
});

window.electron.ipcRenderer.on("update-progress", (percent) => {
  const rounded = Math.round(percent);
  if(updateProgressBar) updateProgressBar.style.width = rounded + "%";
  if(updateProgressText) updateProgressText.innerText = rounded + "%";
  if(consoleBox) consoleBox.value += `Update ${rounded}%\n`;
});

// --- INIT ---
normalizeStoredAccounts();
loadSettings();
renderAccountUI();
loadClients().catch(err => {
  console.error("Client load failed:", err);
});