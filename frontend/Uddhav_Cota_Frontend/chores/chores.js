// chores.js

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

const choresList = document.getElementById("choresList");
const addChoreBtn = document.getElementById("addChoreBtn");
const choreNameInput = document.getElementById("choreName");

// Fetch existing chores
async function loadChores() {
  try {
    const res = await fetch("http://localhost:3000/api/v1/chores", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to load chores");

    const chores = data.chores || [];
    if (chores.length === 0) {
      choresList.innerHTML = "<p>No chores added yet.</p>";
      return;
    }

    choresList.innerHTML = chores.map(chore => `
      <div class="chore-card" data-id="${chore.id}">
        <span>${chore.name}</span>
        <button class="deleteBtn">Delete</button>
      </div>
    `).join('');

    // Attach delete handlers
    document.querySelectorAll(".deleteBtn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest(".chore-card").dataset.id;
        await deleteChore(id);
        loadChores();
      });
    });

  } catch (err) {
    choresList.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

// Add new chore
addChoreBtn.addEventListener("click", async () => {
  const name = choreNameInput.value.trim();
  if (!name) return;

  try {
    const res = await fetch("http://localhost:3000/api/v1/chores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to add chore");

    choreNameInput.value = "";
    loadChores();

  } catch (err) {
    alert(err.message);
  }
});

// Delete chore
async function deleteChore(id) {
  try {
    const res = await fetch(`http://localhost:3000/api/v1/chores/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to delete chore");
  } catch (err) {
    alert(err.message);
  }
}

// Initial load
loadChores();