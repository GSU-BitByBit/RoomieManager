// create-group.js

const createBtn = document.getElementById("createBtn");
const groupNameInput = document.getElementById("groupName");

const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

createBtn.addEventListener("click", async () => {
  const groupName = groupNameInput.value.trim();

  if (!groupName) {
    alert("Please enter a valid group name.");
    return;
  }

  try {
    const data = await apiRequest("/groups", "POST", {
      name: groupName,
    });
    const createdGroupId = data?.id || data?.group?.id;
    if (createdGroupId) {
      localStorage.setItem("groupId", createdGroupId);
    }
    alert(`Group "${groupName}" created successfully!`);
    window.location.href = "/Uddhav_Cota_Frontend/app-shell/app-shell.html";

  } catch (err) {
    alert(err.message || "Failed to create group");
  }
});