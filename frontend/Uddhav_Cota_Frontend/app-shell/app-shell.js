// ----------- API CONFIG -----------

const API_BASE = "http://localhost:3000/api/v1"

function getToken() {
  return localStorage.getItem("accessToken")
}

function getGroupId() {
  return localStorage.getItem("currentGroupId")
}

// ----------- GROUP DATA (loaded from API) -----------

const groupData = {
  name: "Loading...",
  joinCode: "------",
  memberRole: "MEMBER",
  memberCount: 0
}

const mockMembers = [
  { name: "You", email: "you@email.com", role: "ADMIN", color: "purple", initial: "Y" },
  { name: "Alex Rivera", email: "alex@email.com", role: "MEMBER", color: "blue", initial: "A" },
  { name: "Sam Patel", email: "sam@email.com", role: "MEMBER", color: "green", initial: "S" },
  { name: "Jordan Lee", email: "jordan@email.com", role: "MEMBER", color: "orange", initial: "J" }
]

const mockChores = [
  { task: "Vacuum living room", assignee: "Alex Rivera", due: "Today", status: "pending", color: "blue", initial: "A" },
  { task: "Clean bathroom", assignee: "You", due: "Tomorrow", status: "pending", color: "purple", initial: "Y" },
  { task: "Take out trash", assignee: "Sam Patel", due: "Today", status: "done", color: "green", initial: "S" },
  { task: "Wash dishes", assignee: "Jordan Lee", due: "Wed", status: "pending", color: "orange", initial: "J" },
  { task: "Mop kitchen floor", assignee: "Alex Rivera", due: "Thu", status: "overdue", color: "blue", initial: "A" },
  { task: "Wipe counters", assignee: "You", due: "Fri", status: "done", color: "purple", initial: "Y" }
]

const mockBills = [
  { title: "Electricity", amount: 120.00, paidBy: "You", splitWith: 4, due: "Mar 15", status: "unpaid" },
  { title: "Internet", amount: 65.00, paidBy: "Alex Rivera", splitWith: 4, due: "Mar 10", status: "paid" },
  { title: "Water", amount: 45.50, paidBy: "Sam Patel", splitWith: 4, due: "Mar 20", status: "unpaid" },
  { title: "Groceries (shared)", amount: 230.00, paidBy: "You", splitWith: 4, due: "Mar 8", status: "paid" }
]

const mockRules = [
  "Quiet hours are between 10 PM and 8 AM on weekdays, 11 PM to 9 AM on weekends.",
  "Shared spaces (kitchen, living room, bathroom) must be cleaned up after use.",
  "Guests must be communicated to all roommates at least 24 hours in advance.",
  "Bills are split equally and must be paid within 3 days of posting.",
  "Chores rotate weekly. If you can't do your chore, find someone to swap with.",
  "No smoking inside the apartment. Smoking area is on the balcony only.",
  "All food in the fridge must be labeled. Unlabeled food may be discarded after 5 days.",
  "Shared supplies (toilet paper, soap, trash bags) are purchased on a rotation."
]


// ----------- LOAD GROUP (from API) -----------

async function loadGroup() {
  const groupId = getGroupId()
  const token = getToken()

  if (groupId && token) {
    try {
      const res = await fetch(API_BASE + "/groups/" + encodeURIComponent(groupId), {
        headers: { "Authorization": "Bearer " + token }
      })

      const body = await res.json()

      if (body.success) {
        groupData.name = body.data.name
        groupData.joinCode = body.data.joinCode || "------"
        groupData.memberRole = body.data.memberRole || "MEMBER"
        groupData.memberCount = body.data.memberCount || 0
      } else {
        console.warn("Could not load group:", body.error?.message)
      }
    } catch (err) {
      console.warn("Backend unavailable, using fallback data:", err.message)
    }
  } else {
    console.log("No token/groupId found, running in demo mode")
    groupData.name = "Demo Apartment"
    groupData.joinCode = "DEMO01"
    groupData.memberRole = "ADMIN"
    groupData.memberCount = mockMembers.length
  }

  const nameEl = document.querySelector(".group-name")
  const codeEl = document.querySelector(".code-value")

  if (nameEl) nameEl.textContent = groupData.name
  if (codeEl) codeEl.textContent = groupData.joinCode
}


// ----------- ACTIVE NAV -----------

function setActiveNav(page) {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active")
    if (link.textContent.trim().toLowerCase().includes(page)) {
      link.classList.add("active")
    }
  })

  const titleMap = {
    dashboard: "Dashboard",
    members: "Members",
    chores: "Chores",
    bills: "Bills",
    contract: "Contract",
    settings: "Settings"
  }

  const titleEl = document.getElementById("pageTitle")
  if (titleEl) titleEl.textContent = titleMap[page] || page
}


// ----------- PAGE ROUTER -----------

function loadPage(page) {
  const content = document.getElementById("content")
  if (!content) return

  setActiveNav(page)

  const pages = { dashboard, members, chores, bills, contract, settings }
  if (pages[page]) pages[page](content)
}


// ----------- DASHBOARD -----------

function dashboard(el) {
  const pendingChores = mockChores.filter(c => c.status === "pending").length
  const unpaidBills = mockBills.filter(b => b.status === "unpaid").length
  const totalOwed = mockBills
    .filter(b => b.status === "unpaid")
    .reduce((sum, b) => sum + (b.amount / b.splitWith), 0)

  el.innerHTML = `
    <div class="dash-welcome">
      <h1>Welcome back! 👋</h1>
      <p>Here's what's happening in ${groupData.name}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card" onclick="loadPage('members')">
        <div class="stat-icon">👥</div>
        <h3>Members</h3>
        <div class="stat-value">${mockMembers.length}</div>
        <div class="stat-sub">roommates in your group</div>
      </div>

      <div class="stat-card" onclick="loadPage('chores')">
        <div class="stat-icon">🧹</div>
        <h3>Pending Chores</h3>
        <div class="stat-value">${pendingChores}</div>
        <div class="stat-sub">tasks to complete</div>
      </div>

      <div class="stat-card" onclick="loadPage('bills')">
        <div class="stat-icon">💰</div>
        <h3>Unpaid Bills</h3>
        <div class="stat-value">${unpaidBills}</div>
        <div class="stat-sub">$${totalOwed.toFixed(2)} your share</div>
      </div>

      <div class="stat-card" onclick="loadPage('contract')">
        <div class="stat-icon">📝</div>
        <h3>House Rules</h3>
        <div class="stat-value">${mockRules.length}</div>
        <div class="stat-sub">rules in your contract</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Recent Activity</h2>
      </div>
      <div class="panel-body">
        <div class="list-item">
          <div class="list-item-left">
            <div class="avatar avatar-green">S</div>
            <div class="list-item-info">
              <h4>Sam Patel completed "Take out trash"</h4>
              <p>2 hours ago</p>
            </div>
          </div>
          <span class="badge badge-done">Done</span>
        </div>
        <div class="list-item">
          <div class="list-item-left">
            <div class="avatar avatar-blue">A</div>
            <div class="list-item-info">
              <h4>Alex Rivera added a bill: Internet - $65.00</h4>
              <p>5 hours ago</p>
            </div>
          </div>
          <span class="badge badge-paid">Paid</span>
        </div>
        <div class="list-item">
          <div class="list-item-left">
            <div class="avatar avatar-purple">Y</div>
            <div class="list-item-info">
              <h4>You added a bill: Electricity - $120.00</h4>
              <p>Yesterday</p>
            </div>
          </div>
          <span class="badge badge-unpaid">Unpaid</span>
        </div>
      </div>
    </div>
  `
}


// ----------- MEMBERS -----------

function members(el) {
  const memberRows = mockMembers.map(m => `
    <div class="list-item">
      <div class="list-item-left">
        <div class="avatar avatar-${m.color}">${m.initial}</div>
        <div class="list-item-info">
          <h4>${m.name}</h4>
          <p>${m.email}</p>
        </div>
      </div>
      <div class="flex-gap">
        <span class="badge badge-${m.role === 'ADMIN' ? 'admin' : 'member'}">
          ${m.role === 'ADMIN' ? '👑 Admin' : 'Member'}
        </span>
        ${m.name !== 'You' && groupData.memberRole === 'ADMIN' ? `<button class="btn btn-danger btn-sm" onclick="alert('Remove ${m.name} (mock)')">Remove</button>` : ''}
      </div>
    </div>
  `).join("")

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>👥 Group Members (${mockMembers.length})</h2>
        <button class="btn btn-primary btn-sm" onclick="alert('Invite sent (mock)')">+ Invite</button>
      </div>
      <div class="panel-body">
        ${memberRows}
      </div>
    </div>
  `
}


// ----------- CHORES -----------

function chores(el) {
  const statusBadge = (s) => {
    if (s === "done") return '<span class="badge badge-done">✓ Done</span>'
    if (s === "overdue") return '<span class="badge badge-overdue">Overdue</span>'
    return '<span class="badge badge-pending">Pending</span>'
  }

  const choreRows = mockChores.map((c, i) => `
    <div class="list-item">
      <div class="list-item-left">
        <input type="checkbox" class="chore-check" ${c.status === 'done' ? 'checked' : ''} onclick="toggleChore(${i})">
        <div class="avatar avatar-${c.color}">${c.initial}</div>
        <div class="list-item-info">
          <h4 style="${c.status === 'done' ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${c.task}</h4>
          <p>${c.assignee} · Due: ${c.due}</p>
        </div>
      </div>
      ${statusBadge(c.status)}
    </div>
  `).join("")

  const doneCount = mockChores.filter(c => c.status === "done").length
  const progress = Math.round((doneCount / mockChores.length) * 100)

  el.innerHTML = `
    <div class="panel" style="margin-bottom: 20px;">
      <div class="panel-body" style="display: flex; align-items: center; gap: 16px;">
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 14px; font-weight: 600; color: #374151;">Weekly Progress</span>
            <span style="font-size: 14px; font-weight: 700; color: #667eea;">${progress}%</span>
          </div>
          <div style="width: 100%; height: 10px; background: #e5e7eb; border-radius: 999px; overflow: hidden;">
            <div style="width: ${progress}%; height: 100%; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 999px; transition: width 0.4s;"></div>
          </div>
        </div>
        <span style="font-size: 14px; color: #6b7280;">${doneCount}/${mockChores.length} done</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>🧹 Chore List</h2>
        <button class="btn btn-primary btn-sm" onclick="alert('Add chore (mock)')">+ Add Chore</button>
      </div>
      <div class="panel-body">
        ${choreRows}
      </div>
    </div>
  `
}

function toggleChore(index) {
  mockChores[index].status = mockChores[index].status === "done" ? "pending" : "done"
  chores(document.getElementById("content"))
}


// ----------- BILLS -----------

function bills(el) {
  const totalUnpaid = mockBills
    .filter(b => b.status === "unpaid")
    .reduce((sum, b) => sum + b.amount, 0)

  const yourShare = mockBills
    .filter(b => b.status === "unpaid")
    .reduce((sum, b) => sum + (b.amount / b.splitWith), 0)

  const billRows = mockBills.map(b => `
    <div class="list-item">
      <div class="list-item-left">
        <div class="avatar avatar-${b.status === 'paid' ? 'green' : 'red'}" style="font-size: 18px;">
          ${b.status === 'paid' ? '✓' : '$'}
        </div>
        <div class="list-item-info">
          <h4>${b.title}</h4>
          <p>Paid by ${b.paidBy} · Split ${b.splitWith} ways · Due: ${b.due}</p>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: 700; color: #1f2937;">$${b.amount.toFixed(2)}</div>
        <div style="font-size: 12px; color: #6b7280;">$${(b.amount / b.splitWith).toFixed(2)}/person</div>
        <span class="badge badge-${b.status}" style="margin-top: 4px;">${b.status === 'paid' ? 'Paid' : 'Unpaid'}</span>
      </div>
    </div>
  `).join("")

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom: 20px;">
      <div class="stat-card">
        <div class="stat-icon">💳</div>
        <h3>Total Unpaid</h3>
        <div class="stat-value">$${totalUnpaid.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👤</div>
        <h3>Your Share</h3>
        <div class="stat-value">$${yourShare.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <h3>Total Bills</h3>
        <div class="stat-value">${mockBills.length}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>💰 Bills</h2>
        <button class="btn btn-primary btn-sm" onclick="alert('Add bill (mock)')">+ Add Bill</button>
      </div>
      <div class="panel-body">
        ${billRows}
      </div>
    </div>
  `
}


// ----------- CONTRACT -----------

function contract(el) {
  const ruleRows = mockRules.map((r, i) => `
    <div class="rule-item">
      <div class="rule-number">${i + 1}</div>
      <div class="rule-text">${r}</div>
    </div>
  `).join("")

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>📝 Roommate Contract</h2>
        ${groupData.memberRole === 'ADMIN' ? '<button class="btn btn-primary btn-sm" onclick="alert(\'Add rule (mock)\')">+ Add Rule</button>' : ''}
      </div>
      <div class="panel-body">
        <div style="background: #f0f4ff; border-radius: 10px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #667eea;">
          <p style="font-size: 14px; color: #374151; margin: 0;">
            <strong>📌 Agreement:</strong> By being a member of this group, all roommates agree to follow these rules.
            Last updated: March 1, 2026.
          </p>
        </div>
        ${ruleRows}
      </div>
    </div>
  `
}


// ----------- SETTINGS -----------

function settings(el) {
  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>⚙️ Group Settings</h2>
      </div>
      <div class="panel-body">
        <div class="settings-section">
          <h3>Group Information</h3>
          <div class="setting-row">
            <span class="label">Group Name</span>
            <div class="flex-gap">
              <span class="value">${groupData.name}</span>
              <button class="btn btn-secondary btn-sm" onclick="alert('Rename group (not available yet)')">Edit</button>
            </div>
          </div>
          <div class="setting-row">
            <span class="label">Your Role</span>
            <span class="badge badge-${groupData.memberRole === 'ADMIN' ? 'admin' : 'member'}">${groupData.memberRole === 'ADMIN' ? '👑 Admin' : 'Member'}</span>
          </div>
          <div class="setting-row">
            <span class="label">Members</span>
            <span class="value">${groupData.memberCount} members</span>
          </div>
        </div>

        <div class="settings-section">
          <h3>Join Code</h3>
          <div class="setting-row">
            <div>
              <span class="label">Current Code</span>
              <div class="value" style="margin-top: 4px; font-size: 20px; letter-spacing: 3px; color: #667eea;">${groupData.joinCode}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="resetJoinCode()">🔄 Reset Code</button>
          </div>
          <p class="text-muted" style="margin-top: 8px;">Share this code with people you want to invite to your group.</p>
        </div>

        <div class="settings-section">
          <h3>Notifications</h3>
          <div class="setting-row">
            <span class="label">Chore reminders</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
              <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; inset: 0; background: #667eea; border-radius: 24px; transition: 0.3s;">
                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 22px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s;"></span>
              </span>
            </label>
          </div>
          <div class="setting-row">
            <span class="label">Bill due alerts</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
              <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; inset: 0; background: #667eea; border-radius: 24px; transition: 0.3s;">
                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 22px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s;"></span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="danger-zone">
      <h3>⚠️ Danger Zone</h3>
      <p>These actions are irreversible. Please proceed with caution.</p>
      <div class="flex-gap">
        <button class="btn btn-danger" onclick="alert('Leave group (mock)')">Leave Group</button>
        ${groupData.memberRole === 'ADMIN' ? '<button class="btn btn-danger" onclick="alert(\'Delete group (not available yet)\')">Delete Group</button>' : ''}
      </div>
    </div>
  `
}


// ----------- RESET JOIN CODE (API) -----------

async function resetJoinCode() {
  const groupId = getGroupId()
  const token = getToken()

  if (!groupId || !token) return

  if (!confirm("Are you sure you want to reset the join code? The old code will stop working.")) return

  try {
    const res = await fetch(API_BASE + "/groups/" + encodeURIComponent(groupId) + "/join-code/reset", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    })

    const body = await res.json()

    if (!body.success) {
      alert("Failed: " + (body.error?.message || "Unknown error"))
      return
    }

    groupData.joinCode = body.data.joinCode

    // Update topbar badge
    const codeEl = document.querySelector(".code-value")
    if (codeEl) codeEl.textContent = groupData.joinCode

    // Reload settings page to show new code
    loadPage("settings")
    alert("Join code reset to: " + groupData.joinCode)
  } catch (err) {
    alert("Network error: could not reset join code")
  }
}


// ----------- INITIAL LOAD -----------

document.addEventListener("DOMContentLoaded", async () => {
  await loadGroup()
  loadPage("dashboard")
})