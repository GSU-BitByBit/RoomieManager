// Check login
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

// Load group
const groupId = localStorage.getItem("groupId");
const groupInfoDiv = document.getElementById("groupInfo");

if (!groupId) {
  groupInfoDiv.innerHTML = `
    <p>No group found.</p>
    <a href="/Uddhav_Cota_Frontend/onboarding/onboarding.html">
      Go to onboarding
    </a>
  `;
} else {
  loadGroup();
}

async function loadGroup() {
  try {
    const group = await apiRequest(`/groups/${groupId}`, "GET");

    groupInfoDiv.innerHTML = `
      <h2>🏠 ${group.name}</h2>
      <p><strong>Members:</strong> ${group.memberCount}</p>
      <p><strong>Your Role:</strong> ${group.memberRole}</p>
      ${
        group.joinCode
          ? `<p><strong>Invite Code:</strong> ${group.joinCode}</p>`
          : ""
      }
    `;
  } catch (err) {
    groupInfoDiv.innerHTML = `
      <p style="color:red;">${err.message}</p>
    `;
  }
}