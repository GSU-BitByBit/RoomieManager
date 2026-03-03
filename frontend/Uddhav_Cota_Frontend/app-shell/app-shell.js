// ----------- AUTH + GROUP PROTECTION -----------

async function loadGroup() {
  const token = localStorage.getItem("accessToken")
  const groupId = localStorage.getItem("currentGroupId")

  // If no login token → go to login
  if (!token) {
    window.location.href = "../../login/login.html"
    return
  }

  // If no group selected → go to onboarding
  if (!groupId) {
    window.location.href = "../onboarding/onboarding.html"
    return
  }

  try {
    const res = await fetch(
      `http://localhost:3000/api/v1/groups/${groupId}`,
      {
        headers: {
          "Authorization": "Bearer " + token
        }
      }
    )

    const body = await res.json()

    if (!body.success) {
      alert(body.error.message)
      return
    }

    const group = body.data

    // Update topbar dynamically
    document.querySelector(".group-name").textContent = group.name

    if (group.memberRole === "ADMIN") {
      document.querySelector(".join-code-badge").textContent =
        "Code: " + group.joinCode
      document.querySelector(".join-code-badge").style.display = "block"
    } else {
      document.querySelector(".join-code-badge").style.display = "none"
    }

  } catch (err) {
    console.error(err)
    alert("Failed to load group")
  }
}


// ----------- MINI ROUTER -----------

function loadPage(page) {
  const content = document.getElementById("content")

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
        <p><strong>Group settings coming soon</strong></p>
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

loadGroup()
loadPage("dashboard")