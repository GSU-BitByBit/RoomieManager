// ----------- FAKE GROUP (UI TEST MODE) -----------

function loadGroup() {
  console.log("UI test mode: backend disabled")

  const group = {
    name: "Test Apartment",
    memberRole: "ADMIN",
    joinCode: "ABC123"
  }

  const nameEl = document.querySelector(".group-name")
  const codeEl = document.querySelector(".join-code-badge")

  if (nameEl) {
    nameEl.textContent = group.name
  }

  if (codeEl) {
    codeEl.textContent = "Code: " + group.joinCode
    codeEl.style.display = "block"
  }
}


// ----------- MINI ROUTER -----------

function loadPage(page) {
  const content = document.getElementById("content")

  if (!content) return

  if (page === "dashboard") {
    content.innerHTML = `
      <h1>Group Dashboard</h1>

      <div class="cards">
        <div class="card"><h3>Members</h3><p>Coming soon</p></div>
        <div class="card"><h3>Chores</h3><p>Coming soon</p></div>
        <div class="card"><h3>Bills</h3><p>Coming soon</p></div>
        <div class="card"><h3>Contract</h3><p>Coming soon</p></div>
      </div>
    `
  }

  if (page === "members") {
    content.innerHTML = `
      <h1>Members</h1>
      <p>Members list coming soon</p>
    `
  }

  if (page === "chores") {
    content.innerHTML = `
      <h1>Chores</h1>
      <p>Chore management coming soon</p>
    `
  }

  if (page === "bills") {
    content.innerHTML = `
      <h1>Bills</h1>
      <p>Bill tracking coming soon</p>
    `
  }

  if (page === "contract") {
    content.innerHTML = `
      <h1>Contract</h1>
      <p>Roommate contract coming soon</p>
    `
  }

  if (page === "settings") {
    content.innerHTML = `
      <h1>Group Settings</h1>

      <div class="section">
        <p><strong>Name:</strong> Test Apartment</p>
        <p><strong>Your role:</strong> Admin</p>
        <button onclick="alert('Rename group (mock)')">Rename group</button>
      </div>

      <div class="section">
        <button onclick="alert('Reset join code (mock)')">Reset join code</button>
      </div>

      <div class="danger">
        <button onclick="alert('Leave group (mock)')">Leave group</button>
      </div>
    `
  }
}


// ----------- INITIAL LOAD -----------

document.addEventListener("DOMContentLoaded", () => {
  loadGroup()
  loadPage("dashboard")
})