// settings.js

const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "../../samia_frontend/auth/login.html";
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("accessToken");
  window.location.href = "../../samia_frontend/auth/login.html";
});

// Elements
const fullNameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const updateProfileBtn = document.getElementById("updateProfileBtn");
const leaveGroupBtn = document.getElementById("leaveGroupBtn");

// Load user profile
async function loadProfile() {
  try {
    const res = await fetch("http://localhost:3000/api/v1/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to load profile");

    fullNameInput.value = data.user.fullName;
    emailInput.value = data.user.email;

  } catch (err) {
    alert(err.message);
  }
}

// Update profile
updateProfileBtn.addEventListener("click", async () => {
  const fullName = fullNameInput.value.trim();
  const email = emailInput.value.trim();

  if (!fullName || !email) return alert("All fields are required.");

  try {
    const res = await fetch("http://localhost:3000/api/v1/users/me", {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ fullName, email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to update profile");

    alert("Profile updated successfully!");

  } catch (err) {
    alert(err.message);
  }
});

// Leave group
leaveGroupBtn.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to leave your group?")) return;

  try {
    const res = await fetch("http://localhost:3000/api/v1/groups/leave", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to leave group");

    alert("You have left the group.");
    window.location.href = "../../Uddhav_Cota_Frontend/onboarding/onboarding.html";

  } catch (err) {
    alert(err.message);
  }
});

// Initial load
loadProfile();