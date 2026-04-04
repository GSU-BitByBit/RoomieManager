const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userNameDisplay");
const groupsGrid = document.getElementById("groupsGrid");

// Logout
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

initializePage();

async function initializePage() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    const user = userData.user || userData || {};

    const emailName = user.email ? user.email.split("@")[0] : "User";
    const userName = user.fullName || user.name || emailName;

    userNameDisplay.textContent = userName;

    await loadGroups();
  } catch (err) {
    groupsGrid.innerHTML = `<div class="empty-state">${err.message || "Failed to load page."}</div>`;
  }
}

async function loadGroups() {
  try {
    const data = await apiRequest("/groups", "GET");
    const groups = data.groups || [];

    const staticCards = `
      <div class="group-card" id="openJoinCard">
        <div class="group-top">
          <div>
            <h2 class="group-name">Join Group</h2>
            <p class="group-card-text">Enter a code to join an existing household.</p>
          </div>
          <button class="group-open-btn" type="button">+</button>
        </div>

        <div id="joinPanel" class="inline-panel hidden">
          <div class="action-form">
            <input type="text" id="joinCodeInput" placeholder="Enter join code">
            <button id="joinGroupBtn" class="secondary-btn" type="button">Join Group</button>
          </div>
        </div>
      </div>

      <div class="group-card" id="openCreateCard">
        <div class="group-top">
          <div>
            <h2 class="group-name">Create Group</h2>
            <p class="group-card-text">Create a new household and get a join code.</p>
          </div>
          <button class="group-open-btn" type="button">+</button>
        </div>

        <div id="createPanel" class="inline-panel hidden">
          <div class="action-form">
            <input type="text" id="createGroupName" placeholder="Group name">
            <button id="createGroupBtn" class="primary-btn" type="button">Create</button>
          </div>
        </div>
      </div>
    `;

    groupsGrid.innerHTML =
      staticCards +
      groups.map((group) => `
        <div class="group-card clickable" data-id="${group.id}">
          <div class="group-top">
            <div>
              <h2 class="group-name">${group.name}</h2>
            </div>
            <button class="group-open-btn" data-id="${group.id}" type="button">➜</button>
          </div>

          <div class="group-meta">
            <span class="meta-pill">${capitalize(group.memberRole || "Member")}</span>
            <span>👥 ${group.memberCount ?? 0}</span>
          </div>

          <div class="invite-strip">
            <div class="invite-left">
              <span>🪴</span>
              <span class="invite-code">${group.joinCode || "No Code"}</span>
            </div>
            <button class="copy-code-btn" data-code="${group.joinCode || ""}" type="button">📋</button>
          </div>
        </div>
      `).join("");

    bindAll();

  } catch (err) {
    groupsGrid.innerHTML = `<div class="empty-state">${err.message || "Failed to load groups."}</div>`;
  }
}

/* ========================= */
function bindAll() {
  bindActionCards();
  bindCreateJoinButtons();
  preventCloseOnInput();
  bindGroupActions();   // ⭐ FIXED PART
}

/* ========================= */
function bindActionCards() {
  const openCreateCard = document.getElementById("openCreateCard");
  const openJoinCard = document.getElementById("openJoinCard");
  const createPanel = document.getElementById("createPanel");
  const joinPanel = document.getElementById("joinPanel");

  openCreateCard?.addEventListener("click", () => {
    createPanel.classList.toggle("hidden");
    joinPanel.classList.add("hidden");
  });

  openJoinCard?.addEventListener("click", () => {
    joinPanel.classList.toggle("hidden");
    createPanel.classList.add("hidden");
  });
}

/* ========================= */
function preventCloseOnInput() {
  document.getElementById("createPanel")?.addEventListener("click", (e) => e.stopPropagation());
  document.getElementById("joinPanel")?.addEventListener("click", (e) => e.stopPropagation());
}

/* ========================= */
function bindCreateJoinButtons() {
  const createBtn = document.getElementById("createGroupBtn");
  const joinBtn = document.getElementById("joinGroupBtn");

  createBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();

    const name = document.getElementById("createGroupName").value.trim();
    if (!name) return alert("Enter group name");

    try {
      const data = await apiRequest("/groups", "POST", { name });

      localStorage.setItem("groupId", data.id); // ✅ correct group
      window.location.href = "/Uddhav_Cota_Frontend/app-shell/app-shell.html";

    } catch (err) {
      alert(err.message);
    }
  });

  joinBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();

    const code = document.getElementById("joinCodeInput").value.trim();
    if (!code) return alert("Enter code");

    try {
      const data = await apiRequest("/groups/join", "POST", { joinCode: code });

      localStorage.setItem("groupId", data.id); // ✅ correct group
      window.location.href = "/Uddhav_Cota_Frontend/app-shell/app-shell.html";

    } catch (err) {
      alert(err.message);
    }
  });
}

/* ========================= */
/* ⭐ THIS IS THE FIX */
function bindGroupActions() {
  document.querySelectorAll(".group-card.clickable").forEach((card) => {
    card.addEventListener("click", () => {
      const groupId = card.getAttribute("data-id"); // ✅ correct id
      if (!groupId) return;

      localStorage.setItem("groupId", groupId);
      window.location.href = "/Uddhav_Cota_Frontend/app-shell/app-shell.html";
    });
  });

  document.querySelectorAll(".group-open-btn[data-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const groupId = btn.getAttribute("data-id"); // ✅ correct id
      if (!groupId) return;

      localStorage.setItem("groupId", groupId);
      window.location.href = "/Uddhav_Cota_Frontend/app-shell/app-shell.html";
    });
  });

  document.querySelectorAll(".copy-code-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      if (!code) return;

      await navigator.clipboard.writeText(code);
      btn.textContent = "✓";
      setTimeout(() => (btn.textContent = "📋"), 1000);
    });
  });
}

/* ========================= */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}