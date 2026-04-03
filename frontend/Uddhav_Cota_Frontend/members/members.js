// members.js

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

const membersList = document.getElementById("membersList");
const groupId = localStorage.getItem("groupId");

if (!groupId) {
  membersList.innerHTML = `<p>No group found.</p>`;
} else {
  loadMembers();
}

async function loadMembers() {
  try {
    const data = await apiRequest(`/groups/${groupId}/members`, "GET");

    const members = data.members;

    if (!members || members.length === 0) {
      membersList.innerHTML = `<p>No members in this group yet.</p>`;
      return;
    }

    membersList.innerHTML = members.map(member => `
      <div class="member-card">
        <h3>${member.userId}</h3>
        <p><strong>Role:</strong> ${member.role}</p>
        <p><strong>Status:</strong> ${member.status}</p>
        <p><strong>Joined:</strong> ${new Date(member.joinedAt).toLocaleDateString()}</p>
      </div>
    `).join("");
  } catch (err) {
    membersList.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}