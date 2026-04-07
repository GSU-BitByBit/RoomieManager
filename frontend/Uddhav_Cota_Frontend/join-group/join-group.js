// join-group.js

const joinBtn = document.getElementById("joinBtn");
const joinCodeInput = document.getElementById("joinCode");

const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

joinBtn.addEventListener("click", async () => {
  const joinCode = joinCodeInput.value.trim();

  if (!joinCode) {
    alert("Please enter a valid join code.");
    return;
  }

  try {
    const data = await apiRequest("/groups/join", "POST", {
      joinCode: joinCode,
    });
    const joinedGroupId = data?.id || data?.group?.id;
    if (joinedGroupId) {
      localStorage.setItem("groupId", joinedGroupId);
    }
    alert(`Successfully joined the group!`);
    window.location.href = "/Uddhav_Cota_Frontend/app-shell/app-shell.html";

  } catch (err) {
    alert(err.message || "Failed to join group");
  }
});