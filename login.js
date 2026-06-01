const crypto = require("crypto");

const loginStatus = document.getElementById("loginStatus");

function setStatus(message) {
  loginStatus.innerText = message;
}

function getAccounts() {
  return JSON.parse(localStorage.getItem("auraAccounts") || "[]");
}

function setAccounts(accounts) {
  localStorage.setItem("auraAccounts", JSON.stringify(accounts));
}

function saveAccount(account) {
  const accounts = getAccounts();
  const index = accounts.findIndex(saved => saved.id === account.id);

  if (index >= 0) {
    accounts[index] = account;
  } else {
    accounts.push(account);
  }

  setAccounts(accounts);
  localStorage.setItem("auraAccount", JSON.stringify(account));
}

function offlineUuid(username) {
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
}

function createAvatarUrl(account) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(account.name)}/128`;
}

function validUsername(username) {
  return /^[A-Za-z0-9_]{3,16}$/.test(username);
}

async function loginOffline() {
  const username = document.getElementById("offlineUsername").value.trim();

  if (!validUsername(username)) {
    setStatus("Use a 3-16 character username with letters, numbers, or underscores.");
    return;
  }

  const account = {
    id: "offline:" + username.toLowerCase(),
    type: "offline",
    name: username,
    uuid: offlineUuid(username),
    accessToken: "0",
    clientToken: "AuraLauncher",
    avatarUrl: createAvatarUrl({ name: username }),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  saveAccount(account);
  setStatus("Logged in as " + account.name);

  setTimeout(() => {
    window.location.href = "index.html";
  }, 500);
}

async function loginEly() {
  const username = document.getElementById("elyUsername").value.trim();
  const password = document.getElementById("elyPassword").value.trim();

  if (!username || !password) {
    setStatus("Enter Ely.by username and password.");
    return;
  }

  try {
    setStatus("Logging in with Ely.by...");

    const res = await fetch("https://authserver.ely.by/auth/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password,
        clientToken: "AuraLauncher",
        requestUser: true
      })
    });

    const data = await res.json();

    if (!res.ok || !data.accessToken || !data.selectedProfile) {
      setStatus("Ely.by login failed.");
      alert(data.errorMessage || "Wrong username or password.");
      return;
    }

    const account = {
      id: "ely:" + data.selectedProfile.id,
      type: "ely",
      name: data.selectedProfile.name,
      uuid: data.selectedProfile.id,
      accessToken: data.accessToken,
      clientToken: data.clientToken || "AuraLauncher",
      avatarUrl: createAvatarUrl({ name: data.selectedProfile.name }),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveAccount(account);
    setStatus("Logged in as " + account.name);

    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  } catch (err) {
    setStatus("Login error.");
    alert(err.message);
  }
}

function goBack() {
  window.location.href = "index.html";
}
