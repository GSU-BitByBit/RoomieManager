// onboarding.js

// Redirect paths
const createGroupBtn = document.getElementById("createGroup");
const joinGroupBtn = document.getElementById("joinGroup");

// Check if user is logged in
const token = localStorage.getItem("accessToken");
if (!token) {
  // Redirect to login if no token
  window.location.href = "../../samia_frontend/auth/login.html";
}

// Event listeners
createGroupBtn.addEventListener("click", () => {
  // Redirect to create group page
  window.location.href = "../app-shell/create-group.html";
});

joinGroupBtn.addEventListener("click", () => {
  // Redirect to join group page
  window.location.href = "../app-shell/join-group.html";
});