// members.js

const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

const copyInviteBtn = document.getElementById("copyInviteBtn");

async function loadMembers() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    const user = userData.user || userData || {};

    const emailName = user.email ? user.email.split("@")[0] : "User";
    const currentUserName = user.fullName || user.name || emailName;
    const currentUserId = user.id || "";

    document.getElementById("userNameDisplay").textContent = currentUserName;

    const groupId = localStorage.getItem("groupId");
    if (!groupId) {
      document.getElementById("membersList").innerHTML = "<p>No group found.</p>";
      return;
    }

    const groupData = await apiRequest(`/groups/${groupId}`, "GET");
    document.getElementById("inviteCode").textContent = groupData.joinCode || "N/A";

    const data = await apiRequest(`/groups/${groupId}/members`, "GET");
    const members = data.members || [];

    const list = document.getElementById("membersList");
    list.innerHTML = "";

    let roommateNumber = 1;

    members.forEach((member) => {
      let displayName;

      if (member.userId === currentUserId) {
        displayName = currentUserName;
      } else {
        roommateNumber += 1;
        displayName = `Roommate ${roommateNumber - 1}`;
      }

      const div = document.createElement("div");
      div.className = "member-card";

      div.innerHTML = `
        <div class="member-name">${displayName}</div>

        <div class="badge-row">
          <span class="badge ${member.role === "ADMIN" ? "admin" : "member"}">
            ${member.role}
          </span>
          <span class="badge active">${member.status}</span>
        </div>

        <div class="joined">
          Joined: ${member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "N/A"}
        </div>
      `;

      list.appendChild(div);
    });

  } catch (err) {
    document.getElementById("membersList").innerHTML = `
      <p style="color:red;">${err.message || "Failed to load members."}</p>
    `;
  }
}

copyInviteBtn?.addEventListener("click", async () => {
  const inviteCode = document.getElementById("inviteCode").textContent.trim();

  if (!inviteCode || inviteCode === "N/A" || inviteCode === "Loading...") {
    alert("No invite code available.");
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteCode);
    copyInviteBtn.textContent = "Copied!";
    setTimeout(() => {
      copyInviteBtn.textContent = "Copy";
    }, 1500);
  } catch {
    alert("Failed to copy invite code.");
  }
});

loadMembers();