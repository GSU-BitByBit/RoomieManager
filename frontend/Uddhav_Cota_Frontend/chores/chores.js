const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

const choresList = document.getElementById("choresList");
const addChoreBtn = document.getElementById("addChoreBtn");
const choreTitleInput = document.getElementById("choreName");
const choreDueDateInput = document.getElementById("choreDueDate");
const choreAssigneeSelect = document.getElementById("choreAssignee");

const allChoresBtn = document.getElementById("allChoresBtn");
const myChoresBtn = document.getElementById("myChoresBtn");

let currentUser = null;
let currentMembers = [];
let groupId = localStorage.getItem("groupId");
let currentView = "all";

if (!groupId) {
  choresList.innerHTML = `<div class="empty-box">No group found.</div>`;
} else {
  initializePage();
}

allChoresBtn?.addEventListener("click", () => {
  currentView = "all";
  allChoresBtn.classList.add("active");
  myChoresBtn.classList.remove("active");
  loadChores();
});

myChoresBtn?.addEventListener("click", () => {
  currentView = "mine";
  myChoresBtn.classList.add("active");
  allChoresBtn.classList.remove("active");
  loadChores();
});

async function initializePage() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    currentUser = userData.user || userData || {};

    const emailName = currentUser.email ? currentUser.email.split("@")[0] : "User";
    const userName = currentUser.fullName || currentUser.name || emailName;
    document.getElementById("userNameDisplay").textContent = userName;

    await loadMembersForAssign();
    await loadChores();
  } catch (err) {
    choresList.innerHTML = `<div class="empty-box">${err.message || "Failed to load page."}</div>`;
  }
}

async function loadMembersForAssign() {
  try {
    const data = await apiRequest(`/groups/${groupId}/members`, "GET");
    currentMembers = data.members || [];

    choreAssigneeSelect.innerHTML = `<option value="">Assign to...</option>`;

    currentMembers.forEach((member, index) => {
      let displayName = `Roommate ${index + 1}`;

      if (member.userId === currentUser.id) {
        const emailName = currentUser.email ? currentUser.email.split("@")[0] : "You";
        displayName = currentUser.fullName || currentUser.name || emailName;
      }

      choreAssigneeSelect.innerHTML += `
        <option value="${member.userId}">
          ${displayName} (${member.role})
        </option>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadChores() {
  try {
    let endpoint = `/groups/${groupId}/chores`;

    if (currentView === "mine" && currentUser?.id) {
      endpoint += `?assigneeUserId=${encodeURIComponent(currentUser.id)}`;
    }

    const data = await apiRequest(endpoint, "GET");
    let chores = data.chores || [];

    chores = sortChores(chores);

    if (!chores.length) {
      choresList.innerHTML = `<div class="empty-box">No chores found.</div>`;
      return;
    }

    choresList.innerHTML = chores.map((chore) => {
      const assigneeName = getMemberName(chore.assignedToUserId);
      const dueStatusBadge = getDueStatusBadge(chore);

      return `
        <div class="chore-card">
          <div class="chore-top">
            <div>
              <h3 class="chore-title">
                ${chore.title}
                ${dueStatusBadge}
              </h3>
            </div>
            <span class="status-badge ${chore.status === "COMPLETED" ? "status-completed" : "status-pending"}">
              ${chore.status}
            </span>
          </div>

          <p class="chore-meta">${chore.description || "No description"}</p>
          <p class="chore-meta"><strong>Due:</strong> ${chore.dueDate ? new Date(chore.dueDate).toLocaleString() : "No due date"}</p>
          <p class="chore-meta"><strong>Assigned to:</strong> ${assigneeName}</p>

          <div class="chore-actions">
            <select class="assign-select" data-id="${chore.id}">
              <option value="">Assign to...</option>
              ${buildAssignOptions(chore.assignedToUserId)}
            </select>
            <button class="assign-btn" data-id="${chore.id}">Save Assign</button>
            ${chore.status !== "COMPLETED" ? `<button class="complete-btn" data-id="${chore.id}">Complete</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    bindChoreActions();
  } catch (err) {
    choresList.innerHTML = `<div class="empty-box">${err.message || "Failed to load chores."}</div>`;
  }
}

function sortChores(chores) {
  return [...chores].sort((a, b) => {
    const aPriority = getChorePriority(a);
    const bPriority = getChorePriority(b);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

    return aDue - bDue;
  });
}

function getChorePriority(chore) {
  if (chore.status === "COMPLETED") return 3;
  if (!chore.dueDate) return 2;

  const now = new Date();
  const dueDate = new Date(chore.dueDate);
  const diffMs = dueDate - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) return 0; // overdue first
  if (diffDays <= 2) return 1; // due soon next
  return 2;
}

function buildAssignOptions(selectedUserId) {
  return currentMembers.map((member, index) => {
    let displayName = `Roommate ${index + 1}`;

    if (member.userId === currentUser.id) {
      const emailName = currentUser.email ? currentUser.email.split("@")[0] : "You";
      displayName = currentUser.fullName || currentUser.name || emailName;
    }

    return `
      <option value="${member.userId}" ${selectedUserId === member.userId ? "selected" : ""}>
        ${displayName} (${member.role})
      </option>
    `;
  }).join("");
}

function getMemberName(userId) {
  if (!userId) return "Unassigned";

  if (userId === currentUser.id) {
    const emailName = currentUser.email ? currentUser.email.split("@")[0] : "You";
    return currentUser.fullName || currentUser.name || emailName;
  }

  const index = currentMembers.findIndex((member) => member.userId === userId);
  if (index >= 0) return `Roommate ${index + 1}`;

  return "Assigned member";
}

function getDueStatusBadge(chore) {
  if (!chore.dueDate || chore.status === "COMPLETED") return "";

  const now = new Date();
  const dueDate = new Date(chore.dueDate);
  const diffMs = dueDate - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return `<span class="due-badge overdue-badge">Overdue</span>`;
  }

  if (diffDays <= 2) {
    return `<span class="due-badge due-soon-badge">Due Soon</span>`;
  }

  return "";
}

function bindChoreActions() {
  document.querySelectorAll(".assign-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const choreId = btn.dataset.id;
      const select = document.querySelector(`.assign-select[data-id="${choreId}"]`);
      const assigneeUserId = select.value || null;

      try {
        await apiRequest(`/chores/${choreId}/assign`, "PATCH", {
          assigneeUserId: assigneeUserId
        });
        loadChores();
      } catch (err) {
        alert(err.message || "Failed to assign chore.");
      }
    });
  });

  document.querySelectorAll(".complete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const choreId = btn.dataset.id;

      try {
        await apiRequest(`/chores/${choreId}/complete`, "PATCH");
        loadChores();
      } catch (err) {
        alert(err.message || "Failed to complete chore.");
      }
    });
  });
}

addChoreBtn?.addEventListener("click", async () => {
  const title = choreTitleInput.value.trim();
  const dueDate = choreDueDateInput.value;
  const assigneeUserId = choreAssigneeSelect.value;

  if (!title) {
    alert("Please enter a chore title.");
    return;
  }

  const payload = { title };

  if (dueDate) {
    payload.dueDate = new Date(dueDate).toISOString();
  }

  if (assigneeUserId) {
    payload.assigneeUserId = assigneeUserId;
  }

  try {
    await apiRequest(`/groups/${groupId}/chores`, "POST", payload);

    choreTitleInput.value = "";
    choreDueDateInput.value = "";
    choreAssigneeSelect.value = "";

    loadChores();
  } catch (err) {
    alert(err.message || "Failed to add chore.");
  }
});