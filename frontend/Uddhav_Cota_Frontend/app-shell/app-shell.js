// app-shell.js

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

initializeDashboard();

async function initializeDashboard() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    const user = userData.user || userData || {};

    const emailName = user.email ? user.email.split("@")[0] : "User";
    const userName = user.fullName || user.name || emailName;

    document.getElementById("userNameDisplay").textContent = userName;
    document.getElementById("welcomeSubtitle").textContent =
      `Welcome to Dashboard, ${userName}`;

    // Use selected group first
    let groupId = localStorage.getItem("groupId");

    // If no selected group yet, fall back to first group
    if (!groupId) {
      const groupsData = await apiRequest("/groups", "GET");
      const groups = groupsData.groups || [];

      if (!groups.length) {
        showNoGroupState();
        return;
      }

      groupId = groups[0].id;
      localStorage.setItem("groupId", groupId);
    }

    const dashboardData = await apiRequest(`/groups/${groupId}/dashboard`, "GET");
    renderDashboard(dashboardData);

  } catch (err) {
    document.querySelector(".main-content").innerHTML = `
      <p style="color:red;">${err.message || "Failed to load dashboard."}</p>
    `;
  }
}

function showNoGroupState() {
  document.querySelector(".main-content").innerHTML = `
    <h1>Welcome to Roomie Manager</h1>
    <p>You are not in a group yet.</p>
    <a href="/Uddhav_Cota_Frontend/Group-Hub/Group-Hub.html">Go to Group Hub</a>
  `;
}

function renderDashboard(data) {
  const group = data.group || {};
  const chores = data.chores || {};
  const members = data.members || {};
  const finance = data.finance || {};
  const contract = data.contract || {};

  document.getElementById("welcomeTitle").textContent =
    ` ${group.name || "Home"}`;

  document.getElementById("inviteCode").textContent =
    group.joinCode || "N/A";

  document.getElementById("roommateCount").textContent =
    members.totalActive ?? 0;

  document.getElementById("roommateSubtext").textContent =
    `${members.adminCount ?? 0} admin`;

  document.getElementById("openChores").textContent =
    chores.pendingCount ?? 0;

  document.getElementById("choresSubtext").textContent =
    `${chores.completedCount ?? 0} done`;

  document.getElementById("statsRoommates").textContent =
    `${members.totalActive ?? 0} active`;

  document.getElementById("statsChores").textContent =
    `${chores.pendingCount ?? 0} open`;

  document.getElementById("statsRole").textContent =
    group.memberRole || "Member";

  const vibe = getHouseholdVibe(
    chores.pendingCount ?? 0,
    finance.billCount ?? 0
  );

  document.getElementById("householdVibe").textContent = vibe;

  document.getElementById("recentActivity").innerHTML =
    buildRecentActivity(chores, finance, contract);
}

function getHouseholdVibe(pendingChores, billCount) {
  if (pendingChores === 0 && billCount <= 1) return "Peaceful";
  if (pendingChores <= 3) return "Steady";
  return "Busy";
}

function buildRecentActivity(chores, finance, contract) {
  const items = [];

  if ((chores.completedCount ?? 0) > 0) {
    items.push(`${chores.completedCount} chore(s) completed.`);
  }

  if ((finance.billCount ?? 0) > 0) {
    items.push(`${finance.billCount} bill(s) recorded.`);
  }

  if ((finance.paymentCount ?? 0) > 0) {
    items.push(`${finance.paymentCount} payment(s) made.`);
  }

  if ((contract.publishedVersion ?? 0) > 0) {
    items.push(`Agreement version ${contract.publishedVersion} published.`);
  }

  if (!items.length) {
    return `No activity yet — things will show up as your household gets going.`;
  }

  return `
    <ul class="activity-list">
      ${items.map(item => `<li>${item}</li>`).join("")}
    </ul>
  `;
}