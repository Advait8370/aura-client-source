const { ipcRenderer } = require("electron");

const statusText = document.getElementById("status");
const consoleBox = document.getElementById("console");
const accountName = document.getElementById("accountName");

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

let clientsCache = [];
let elyUser = JSON.parse(localStorage.getItem("elyUser") || "null");

let settings = JSON.parse(localStorage.getItem("auraSettings") || "{}");

let javaPath = settings.javaPath || "java";
let gameDir = settings.gameDir || "";
let closeAfterLaunch = settings.closeAfterLaunch || false;

function saveSettings() {
  settings = {
    ram: document.getElementById("ram").value,
    javaPath,
    gameDir,
    closeAfterLaunch: closeAfterLaunchInput.checked
  };

  localStorage.setItem("auraSettings", JSON.stringify(settings));
  statusText.innerText = "Settings saved";
}

function loadSettings() {
  document.getElementById("ram").value = settings.ram || "2";
  javaPathInput.value = javaPath === "java" ? "" : javaPath;
  gameDirInput.value = gameDir || "";
  closeAfterLaunchInput.checked = closeAfterLaunch;
}

function showPage(page, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  document.getElementById("page-" + page).classList.add("active-page");

  document.querySelectorAll(".side-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  if (page === "clients") {
    checkManagerClient();
  }

  if (page === "skins") {
    updateSkinUI();
  }
}

async function loadClients() {
  try {
    clientsCache = await ipcRenderer.invoke("load-clients");

    clientSelect.innerHTML = "";
    clientManagerSelect.innerHTML = "";

    clientsCache.forEach(client => {
      const opt1 = document.createElement("option");
      opt1.value = client.id;
      opt1.textContent = client.name;
      clientSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = client.id;
      opt2.textContent = client.name;
      clientManagerSelect.appendChild(opt2);
    });

    await checkSelectedClient();
    await checkManagerClient();
  } catch (err) {
    statusText.innerText = "Failed to load clients";
    consoleBox.value += err.message + "\n";
  }
}

async function loginEly() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    statusText.innerText = "Enter login details";
    return;
  }

  statusText.innerText = "Logging in...";

  try {
    const res = await fetch("https://authserver.ely.by/auth/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        clientToken: "AuraLauncher",
        requestUser: true
      })
    });

    const data = await res.json();

    if (!res.ok || !data.accessToken) {
      statusText.innerText = "Login failed";
      alert(data.errorMessage || "Wrong username/password");
      return;
    }

    elyUser = {
      name: data.selectedProfile.name,
      uuid: data.selectedProfile.id,
      accessToken: data.accessToken,
      clientToken: data.clientToken || "AuraLauncher"
    };

    localStorage.setItem("elyUser", JSON.stringify(elyUser));
    accountName.innerText = elyUser.name;
    document.getElementById("username").value = elyUser.name;
    statusText.innerText = "Logged in: " + elyUser.name;

    updateSkinUI();
  } catch (err) {
    statusText.innerText = "Login error";
    alert(err.message);
  }
}

function logoutEly() {
  elyUser = null;
  localStorage.removeItem("elyUser");
  accountName.innerText = "Not logged in";
  statusText.innerText = "Logged out";
  updateSkinUI();
}

function updateSkinUI() {
  if (!elyUser) {
    skinAvatar.style.display = "none";
    defaultAvatar.style.display = "grid";
    skinPreview.style.display = "none";
    skinName.innerText = "Not logged in";
    return;
  }

  accountName.innerText = elyUser.name;
  skinName.innerText = elyUser.name;

  const skinUrl = `https://skinsystem.ely.by/skins/${elyUser.name}`;
  const avatarUrl = `https://skinsystem.ely.by/skins/${elyUser.name}`;

  skinAvatar.src = avatarUrl;
  skinAvatar.style.display = "block";
  defaultAvatar.style.display = "none";

  skinPreview.src = skinUrl;
  skinPreview.style.display = "block";
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
  if (!clientSelect.value) return;

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
}

async function checkManagerClient() {
  if (!clientManagerSelect.value) return;

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
  if (!clientManagerSelect.value) return;

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
  if (!clientManagerSelect.value) return;

  const ok = confirm("Delete selected client?");
  if (!ok) return;

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
  if (!elyUser) {
    statusText.innerText = "Login first";
    return;
  }

  resetProgress();
  consoleBox.value = "";
  launchLog.value = "";
  crashLog.value = "";
  logModal.classList.remove("hidden");

  const clientId = clientSelect.value;

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
      username: elyUser.name,
      uuid: elyUser.uuid,
      accessToken: elyUser.accessToken,
      clientToken: elyUser.clientToken,
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
  }
}

function closeCrashModal() {
  crashModal.classList.add("hidden");
}

ipcRenderer.on("download-progress", (e, percent) => {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));

  downloadProgress.style.width = p + "%";
  downloadPercent.innerText = p + "%";

  managerProgress.style.width = p + "%";
  managerPercent.innerText = p + "%";
});

ipcRenderer.on("launch-status", (e, msg) => {
  statusText.innerText = msg;
  logStatus.innerText = msg;

  if (msg === "Minecraft started.") {
    setTimeout(() => logModal.classList.add("hidden"), 1500);
  }
});

ipcRenderer.on("launch-log", (e, msg) => {
  consoleBox.value += msg + "\n";
  consoleBox.scrollTop = consoleBox.scrollHeight;

  launchLog.value += msg + "\n";
  launchLog.scrollTop = launchLog.scrollHeight;

  crashLog.value += msg + "\n";
  crashLog.scrollTop = crashLog.scrollHeight;
});

ipcRenderer.on("minecraft-closed", (e, code) => {
  if (code !== 0) {
    crashText.innerText = "Exit code: " + code;
    crashModal.classList.remove("hidden");
  }
});

if (elyUser) {
  accountName.innerText = elyUser.name;
  document.getElementById("username").value = elyUser.name;
}

loadSettings();
updateSkinUI();
loadClients();