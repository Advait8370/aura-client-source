const { ipcRenderer } = require("electron");

const loginStatus = document.getElementById("loginStatus");

function setStatus(msg) {
  loginStatus.innerText = msg;
}

async function loginMicrosoft() {
  try {
    setStatus("Opening Microsoft login...");

    const data = await ipcRenderer.invoke("login-microsoft");

    const account = {
      type: "microsoft",
      name: data.name,
      uuid: data.uuid,
      accessToken: data.access_token,
      clientToken: data.client_token || "AuraLauncher"
    };

    localStorage.setItem("auraAccount", JSON.stringify(account));

    setStatus("Logged in as " + account.name);

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  } catch (err) {
    setStatus("Microsoft login failed");
    alert(err.message);
  }
}

async function loginEly() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    setStatus("Enter Ely.by username and password");
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

    if (!res.ok || !data.accessToken) {
      setStatus("Ely.by login failed");
      alert(data.errorMessage || "Wrong username/password");
      return;
    }

    const account = {
      type: "ely",
      name: data.selectedProfile.name,
      uuid: data.selectedProfile.id,
      accessToken: data.accessToken,
      clientToken: data.clientToken || "AuraLauncher"
    };

    localStorage.setItem("auraAccount", JSON.stringify(account));

    setStatus("Logged in as " + account.name);

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  } catch (err) {
    setStatus("Login error");
    alert(err.message);
  }
}

function goBack() {
  window.location.href = "index.html";
}