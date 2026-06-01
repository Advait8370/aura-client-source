window.onerror = function(message, url, line) {
  console.error("JS ERROR:", message, "Line:", line);
  alert("JS ERROR: " + message + " Line: " + line);
};

const { ipcRenderer } = require("electron");

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

let clientsCache = [];
let currentAccount = readCurrentAccount();
let settings = JSON.parse(localStorage.getItem("auraSettings") || "{}");
let javaPath = settings.javaPath || "java";
let gameDir = settings.gameDir || "";
let closeAfterLaunch = settings.closeAfterLaunch || false;

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
  if (!account) {
    return "No account";
  }

  return account.type === "ely" ? "Ely.by Account" : "Offline Account";
}

function accountAvatar(account) {
  if (!account) {
    return "";
  }

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

  accountSelect.innerHTML = "";

  if (accounts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved accounts";
    accountSelect.appendChild(option);
  } else {
    accounts.forEach(account => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} · ${account.type === "ely" ? "Ely.by" : "Offline"}`;
      accountSelect.appendChild(option);
    });
  }

  if (currentAccount) {
    accountSelect.value = currentAccount.id;
    accountName.innerText = currentAccount.name;
    accountType.innerText = accountLabel(currentAccount);
    accountNameLarge.innerText = currentAccount.name;
    currentAccountStatus.innerText = accountLabel(currentAccount) + " selected";
    accountUuid.innerText = "UUID: " + currentAccount.uuid;
    accountStatusIndicator.innerText = "Signed in";
    accountStatusIndicator.className = "install-state installed";

    const avatarUrl = accountAvatar(currentAccount);
    skinAvatar.src = avatarUrl;
    skinAvatar.style.display = "block";
    defaultAvatar.style.display = "none";
    accountAvatarLarge.src = avatarUrl;
    accountAvatarLarge.style.display = "block";
  } else {
    accountName.innerText = "Not logged in";
    accountType.innerText = "Add an account";
    accountNameLarge.innerText = "Not logged in";
    currentAccountStatus.innerText = "No account selected";
    accountUuid.innerText = "UUID unavailable";
    accountStatusIndicator.innerText = "Signed out";
    accountStatusIndicator.className = "install-state missing";
    skinAvatar.style.display = "none";
    defaultAvatar.style.display = "grid";
    accountAvatarLarge.style.display = "none";
  }

  updateSkinUI();
}

function showPage(page, btn) {
  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active-page");
  });

  const target = document.getElementById("page-" + page);
  if (target) {
    target.classList.add("active-page");
  }

  document.querySelectorAll(".side-btn").forEach(button => {
    button.classList.remove("active");
  });

  if (btn) {
    btn.classList.add("active");
  } else {
    const buttons = Array.from(document.querySelectorAll(".side-btn"));
    const activeButton = buttons.find(button => button.textContent.trim().toLowerCase() === page);
    if (activeButton) {
      activeButton.classList.add("active");
    }
  }

  if (page === "clients") {
    checkManagerClient();
  }

  if (page === "account") {
    renderAccountUI();
  }

  if (page === "skins") {
    updateSkinUI();
  }
}

function openLoginPage() {
  window.location.href = "login.html";
}

function switchAccount(accountId) {
  const account = readAccounts().find(saved => saved.id === accountId);

  if (!account) {
    return;
  }

  setCurrentAccount(account);
  statusText.innerText = "Switched to " + account.name;
}

function logoutAccount() {
  setCurrentAccount(null);
  statusText.innerText = "Logged out";
}

function deleteCurrentAccount() {
  if (!currentAccount) {
    statusText.innerText = "No account selected";
    return;
  }

  const ok = confirm("Delete account " + currentAccount.name + "?");
  if (!ok) {
    return;
  }

  const accounts = readAccounts().filter(account => account.id !== currentAccount.id);
  writeAccounts(accounts);
  setCurrentAccount(accounts[0] || null);
  statusText.innerText = "Account deleted";
}

function saveSettings() {
  settings = {
    ram: document.getElementById("ram").value,
    javaPath,
    gameDir,
    closeAfterLaunch: closeAfterLaunchInput.checked
  };

  closeAfterLaunch = settings.closeAfterLaunch;
  localStorage.setItem("auraSettings", JSON.stringify(settings));
  statusText.innerText = "Settings saved";
}

function loadSettings() {
  const ramSelect = document.getElementById("ram");
  const themeSelect = document.getElementById("theme");
  const accentSelect = document.getElementById("accentColor");
  const savedTheme = localStorage.getItem("auraTheme") || "dark";
  const savedAccent = localStorage.getItem("auraAccent") || "#22c55e";

  document.body.dataset.theme = savedTheme;
  document.documentElement.style.setProperty("--accent", savedAccent);

  if (ramSelect) {
    ramSelect.value = settings.ram || "2";
  }

  if (themeSelect) {
    themeSelect.value = savedTheme;
  }

  if (accentSelect) {
    accentSelect.value = savedAccent;
  }

  if (javaPathInput) {
    javaPathInput.value = javaPath === "java" ? "" : javaPath;
  }

  if (gameDirInput) {
    gameDirInput.value = gameDir || "";
  }

  if (closeAfterLaunchInput) {
    closeAfterLaunchInput.checked = closeAfterLaunch;
  }
}

async function loadClients() {
  try {
    clientsCache = await ipcRenderer.invoke("load-clients");
    clientSelect.innerHTML = "";
    clientManagerSelect.innerHTML = "";

    clientsCache.forEach(client => {
      const launchOption = document.createElement("option");
      launchOption.value = client.id;
      launchOption.textContent = client.name;
      clientSelect.appendChild(launchOption);

      const managerOption = document.createElement("option");
      managerOption.value = client.id;
      managerOption.textContent = client.name;
      clientManagerSelect.appendChild(managerOption);
    });

    if (clientsCache.length > 0) {
      clientSelect.value = clientsCache[0].id;
      clientManagerSelect.value = clientsCache[0].id;
    }

    await checkSelectedClient();
    await checkManagerClient();
  } catch (err) {
    statusText.innerText = "Failed to load clients";
    console.error(err);
    consoleBox.value += err.message + "\n";
  }
}

function updateSkinUI() {
  if (!currentAccount) {
    skinPreview.style.display = "none";
    skinName.innerText = "Not logged in";
    skinHelp.innerText = "Login with Ely.by to show your skin.";
    return;
  }

  skinName.innerText = currentAccount.name;

  if (currentAccount.type !== "ely") {
    skinPreview.style.display = "none";
    skinHelp.innerText = "Offline accounts do not include Ely.by skin sync.";
    return;
  }

  skinPreview.src = `https://skinsystem.ely.by/skins/${encodeURIComponent(currentAccount.name)}`;
  skinPreview.style.display = "block";
  skinHelp.innerText = "Ely.by skin preview";
}

async function openElySkins() {
  await ipcRenderer.invoke("open-external", "https://ely.by/skins");
}

async function selectJava() {
  const selected = await ipcRenderer.invoke("select-java");

  if (selected) {
    javaPath = selected;
    javaPathInput.value = selected;
    saveSettings();
    statusText.innerText = "Java selected";
  }
}

async function selectGameDir() {
  const selected = await ipcRenderer.invoke("select-game-dir");

  if (selected) {
    gameDir = selected;
    gameDirInput.value = selected;
    saveSettings();
    await checkSelectedClient();
    await checkManagerClient();
    statusText.innerText = "Game directory selected";
  }
}

async function checkSelectedClient() {
  if (!clientSelect || !clientSelect.value) {
    return;
  }

  try {
    const installed = await ipcRenderer.invoke("check-client", {
      client: clientSelect.value,
      gameDir
    });

    if (installed) {
      installState.innerText = "Installed";
      installState.className = "install-state installed";
    } else {
      installState.innerText = "Not installed";
      installState.className = "install-state missing";
    }
  } catch (err) {
    console.error(err);
  }
}

async function checkManagerClient() {
  if (!clientManagerSelect || !clientManagerSelect.value) {
    return;
  }

  try {
    const installed = await ipcRenderer.invoke("check-client", {
      client: clientManagerSelect.value,
      gameDir
    });

    if (installed) {
      managerState.innerText = "Installed";
      managerState.className = "install-state installed";
    } else {
      managerState.innerText = "Not installed";
      managerState.className = "install-state missing";
    }
  } catch (err) {
    console.error(err);
  }
}

function syncClientSelect() {
  clientSelect.value = clientManagerSelect.value;
  checkSelectedClient();
  checkManagerClient();
}

function resetProgress() {
  downloadProgress.style.width = "0%";
  downloadPercent.innerText = "0%";
  managerProgress.style.width = "0%";
  managerPercent.innerText = "0%";
}

async function repairSelectedClient() {
  if (!clientManagerSelect.value) {
    return;
  }

  resetProgress();
  consoleBox.value = "";
  launchLog.value = "";
  logModal.classList.remove("hidden");
  logStatus.innerText = "Repairing client...";

  try {
    await ipcRenderer.invoke("repair-client", {
      client: clientManagerSelect.value,
      gameDir
    });

    logStatus.innerText = "Repair complete";
    await checkSelectedClient();
    await checkManagerClient();
    setTimeout(() => logModal.classList.add("hidden"), 1200);
  } catch (err) {
    logStatus.innerText = "Repair failed";
    consoleBox.value += err.message + "\n";
    launchLog.value += err.message + "\n";
  }
}

async function deleteSelectedClient() {
  if (!clientManagerSelect.value) {
    return;
  }

  const ok = confirm("Delete selected client?");
  if (!ok) {
    return;
  }

  resetProgress();
  consoleBox.value = "";
  launchLog.value = "";

  try {
    await ipcRenderer.invoke("delete-client", {
      client: clientManagerSelect.value,
      gameDir
    });

    statusText.innerText = "Client deleted";
    await checkSelectedClient();
    await checkManagerClient();
  } catch (err) {
    statusText.innerText = "Delete failed";
    consoleBox.value += err.message + "\n";
  }
}

async function play() {
  const clientId = clientSelect.value;

  if (!clientId) {
    alert("No client selected.");
    return;
  }

  if (!currentAccount) {
    statusText.innerText = "Login first";
    alert("Please add or select an account first.");
    showPage("account");
    return;
  }

  resetProgress();
  consoleBox.value = "";
  launchLog.value = "";
  crashLog.value = "";
  logModal.classList.remove("hidden");

  try {
    logStatus.innerText = "Checking client...";
    statusText.innerText = "Checking client...";

    const installed = await ipcRenderer.invoke("check-client", {
      client: clientId,
      gameDir
    });

    if (!installed) {
      logStatus.innerText = "Downloading client...";
      statusText.innerText = "Downloading client...";

      await ipcRenderer.invoke("install-client", {
        client: clientId,
        gameDir
      });

      await checkSelectedClient();
      await checkManagerClient();
    }

    logStatus.innerText = "Launching Minecraft...";
    statusText.innerText = "Launching Minecraft...";

    ipcRenderer.send("launch-game", {
      client: clientId,
      accountType: currentAccount.type,
      username: currentAccount.name,
      uuid: currentAccount.uuid,
      accessToken: currentAccount.accessToken,
      clientToken: currentAccount.clientToken,
      ram: document.getElementById("ram").value,
      javaPath,
      gameDir,
      closeAfterLaunch: closeAfterLaunchInput.checked
    });
  } catch (err) {
    logStatus.innerText = "Error";
    statusText.innerText = "Error: " + err.message;
    consoleBox.value += err.message + "\n";
    launchLog.value += err.message + "\n";
    console.error(err);
  }
}

function closeLogModal() {
  logModal.classList.add("hidden");
  statusText.innerText = "Launcher running";
}

function closeCrashModal() {
  crashModal.classList.add("hidden");
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
  statusText.innerText = "Checking for updates...";
  await ipcRenderer.invoke("check-for-updates");
}

ipcRenderer.on("download-progress", (event, data) => {
  const payload = typeof data === "number" ? { percent: data } : data;
  const percent = Math.round(Number(payload.percent) || 0);

  downloadProgress.style.width = percent + "%";
  managerProgress.style.width = percent + "%";
  downloadPercent.innerText = `${percent}% • ${payload.speed?.toFixed(2) || 0} MB/s`;
  managerPercent.innerText = `${percent}% • ETA ${Math.round(payload.eta || 0)}s`;
});

ipcRenderer.on("launch-status", (event, message) => {
  statusText.innerText = message;
  logStatus.innerText = message;

  if (message === "Minecraft started.") {
    setTimeout(() => logModal.classList.add("hidden"), 1500);
  }
});

ipcRenderer.on("launch-log", (event, message) => {
  consoleBox.value += message + "\n";
  consoleBox.scrollTop = consoleBox.scrollHeight;

  launchLog.value += message + "\n";
  launchLog.scrollTop = launchLog.scrollHeight;

  crashLog.value += message + "\n";
  crashLog.scrollTop = crashLog.scrollHeight;
});

ipcRenderer.on("minecraft-closed", (event, code) => {
  if (code !== 0) {
    crashText.innerText = "Exit code: " + code;
    crashModal.classList.remove("hidden");
  }
});

ipcRenderer.on("update-status", (event, message) => {
  statusText.innerText = message;
});

ipcRenderer.on("update-progress", (event, percent) => {
  consoleBox.value += `Update ${Math.round(percent)}%\n`;
});

normalizeStoredAccounts();
loadSettings();
renderAccountUI();
loadClients().catch(err => {
  console.error("Client load failed:", err);
});
