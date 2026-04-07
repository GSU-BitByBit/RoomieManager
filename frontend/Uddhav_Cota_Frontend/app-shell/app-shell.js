// app-shell.js

const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

const copyInviteBtn = document.getElementById("copyInviteBtn");

// Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

copyInviteBtn?.addEventListener("click", async () => {
  const inviteCode = document.getElementById("inviteCode")?.textContent.trim();

  if (!inviteCode || inviteCode === "Loading..." || inviteCode === "N/A") {
    notify("No invite code available yet.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteCode);
    notify("Invite code copied.");
  } catch {
    notify("Failed to copy invite code.", true);
  }
});

initializeDashboard();

async function initializeDashboard() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    const user = userData.user || userData || {};

    const emailName = user.email ? user.email.split("@")[0] : "User";
    const userName = user.fullName || user.name || emailName;

    document.getElementById("userNameDisplay").textContent = userName;
    document.getElementById("welcomeSubtitle").textContent =
      `Welcome to Dashboard, ${userName}`;

    // Use selected group first
    let groupId = localStorage.getItem("groupId");

    // If no selected group yet, fall back to first group
    if (!groupId) {
      const groupsData = await apiRequest("/groups", "GET");
      const groups = groupsData.groups || [];

      if (!groups.length) {
        showNoGroupState();
        return;
      }

      groupId = groups[0].id;
      localStorage.setItem("groupId", groupId);
    }

    const [dashboardData, financeSnapshot, nextAssignedChore] = await Promise.all([
      apiRequest(`/groups/${groupId}/dashboard`, "GET"),
      getGroupFinanceSnapshot(groupId),
      getNextAssignedChore(groupId, user.id)
    ]);

    renderDashboard(dashboardData, user.id, financeSnapshot, nextAssignedChore);

  } catch (err) {
    document.querySelector(".main-content").innerHTML = `
      <p style="color:red;">${err.message || "Failed to load dashboard."}</p>
    `;
  }
}

function showNoGroupState() {
  document.querySelector(".main-content").innerHTML = `
    <h1>Welcome to Roomie Manager</h1>
    <p>You are not in a group yet.</p>
    <a href="/Uddhav_Cota_Frontend/settings/settings.html">Go to Settings</a>
  `;
}

async function getGroupFinanceSnapshot(groupId) {
  const [billsResult, balancesResult] = await Promise.allSettled([
    apiRequest(`/groups/${groupId}/bills?sortBy=incurredAt&sortOrder=desc&page=1&pageSize=200`, "GET"),
    apiRequest(`/groups/${groupId}/balances`, "GET")
  ]);

  return {
    bills: billsResult.status === "fulfilled" ? billsResult.value.bills || [] : [],
    balances: balancesResult.status === "fulfilled" ? balancesResult.value.balances || [] : []
  };
}

async function getNextAssignedChore(groupId, userId) {
  try {
    const data = await apiRequest(
      `/groups/${groupId}/chores?assigneeUserId=${encodeURIComponent(userId)}&status=PENDING&sortBy=dueDate&sortOrder=asc&page=1&pageSize=100`,
      "GET"
    );

    const chores = Array.isArray(data.chores) ? data.chores : [];
    if (!chores.length) {
      return null;
    }

    const dated = chores
      .filter((chore) => chore?.dueDate)
      .filter((chore) => !Number.isNaN(new Date(chore.dueDate).getTime()))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (dated.length) {
      return dated[0];
    }

    return chores[0];
  } catch {
    return null;
  }
}

function renderDashboard(data, currentUserId, financeSnapshot, nextAssignedChore) {
  const group = data.group || {};
  const chores = data.chores || {};
  const members = data.members || {};
  const finance = data.finance || {};
  const contract = data.contract || {};
  const unpaidSummary = buildUnpaidSummary(
    currentUserId,
    financeSnapshot?.bills || [],
    financeSnapshot?.balances || []
  );
  const householdStatus = getHouseholdStatus({
    pendingCount: chores.pendingCount ?? 0,
    overdueCount: chores.overdueCount ?? 0,
    unpaidCount: unpaidSummary.count,
    assignedToMePendingCount: chores.assignedToMePendingCount ?? 0
  });

  document.getElementById("welcomeTitle").textContent =
    group.name || "Home";
  document.getElementById("welcomeTitlePanel").textContent =
    group.name || "Home";

  document.getElementById("inviteCode").textContent =
    group.joinCode || "N/A";
  document.getElementById("inviteCodePanel").textContent =
    group.joinCode || "N/A";

  document.getElementById("roommateCount").textContent =
    members.totalActive ?? 0;

  document.getElementById("roommateSubtext").textContent =
    `${members.adminCount ?? 0} admin`;

  document.getElementById("openChores").textContent =
    chores.pendingCount ?? 0;

  document.getElementById("choresSubtext").textContent =
    `${chores.assignedToMePendingCount ?? 0} assigned to you`;

  document.getElementById("unpaidBillsCount").textContent = unpaidSummary.count;
  document.getElementById("unpaidBillsSubtext").textContent = unpaidSummary.subtext;
  document.getElementById("unpaidTotalPanel").textContent = unpaidSummary.totalLabel;
  document.getElementById("householdStatus").textContent = householdStatus.label;
  document.getElementById("householdStatusSubtext").textContent = householdStatus.subtext;

  document.getElementById("statsRole").textContent =
    group.memberRole || "Member";

  document.getElementById("assignedToMePanel").textContent =
    `${chores.assignedToMePendingCount ?? 0} pending`;

  document.getElementById("nextChorePanel").textContent =
    getNextChoreLabel(nextAssignedChore);

  document.getElementById("latestBillPanel").textContent =
    finance.latestBillIncurredAt
      ? formatDateTime(finance.latestBillIncurredAt)
      : "No bills yet";

  document.getElementById("recentActivity").innerHTML =
    buildRecentActivity(chores, finance, contract, unpaidSummary);
}

function getHouseholdStatus({ pendingCount, overdueCount, unpaidCount, assignedToMePendingCount }) {
  if (overdueCount > 0 || unpaidCount > 0) {
    return {
      label: "Needs Attention",
      subtext: `${overdueCount} overdue chores and ${unpaidCount} unpaid bill${unpaidCount === 1 ? "" : "s"}.`
    };
  }

  if (pendingCount === 0) {
    return {
      label: "Calm",
      subtext: "No open chores and no unpaid bills."
    };
  }

  if (pendingCount <= 3 && assignedToMePendingCount <= 1) {
    return {
      label: "Steady",
      subtext: "Workload is balanced this week."
    };
  }

  return {
    label: "Busy",
    subtext: `${pendingCount} open chores to work through.`
  };
}

function getNextChoreLabel(chore) {
  if (!chore) {
    return "No assigned chores";
  }

  if (!chore.dueDate) {
    return "No due date";
  }

  const due = new Date(chore.dueDate);
  if (Number.isNaN(due.getTime())) {
    return "No due date";
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const prefix = due < startOfToday ? "Overdue" : "Due";
  return `${prefix} ${formatDateTime(chore.dueDate)}`;
}

function buildRecentActivity(chores, finance, contract, unpaidSummary) {
  const items = [];

  if ((unpaidSummary?.count ?? 0) > 0) {
    items.push(`You currently owe ${unpaidSummary.totalLabel}.`);
  }

  if ((chores.completedCount ?? 0) > 0) {
    items.push(`${chores.completedCount} chore(s) completed.`);
  }

  if ((finance.billCount ?? 0) > 0) {
    items.push(`${finance.billCount} bill(s) recorded.`);
  }

  if ((finance.paymentCount ?? 0) > 0) {
    items.push(`${finance.paymentCount} payment(s) made.`);
  }

  if ((contract.publishedVersion ?? 0) > 0) {
    items.push(`Agreement version ${contract.publishedVersion} published.`);
  }

  if (!items.length) {
    return `No activity yet — things will show up as your household gets going.`;
  }

  return `
    <ul class="activity-list">
      ${items.map(item => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function buildUnpaidSummary(currentUserId, bills, balances) {
  const liabilityBills = bills.filter((bill) => {
    if (!bill || bill.paidByUserId === currentUserId) {
      return false;
    }

    return (bill.splits || []).some(
      (split) => split.userId === currentUserId && Number(split.amount) > 0
    );
  });

  const owedBalances = (balances || [])
    .map((entry) => {
      const member = (entry.memberBalances || []).find(
        (balance) => balance.userId === currentUserId
      );

      if (!member) {
        return null;
      }

      const netAmount = Number(member.netAmount);
      if (Number.isNaN(netAmount) || netAmount >= 0) {
        return null;
      }

      return {
        currency: entry.currency || "USD",
        amount: Math.abs(netAmount)
      };
    })
    .filter(Boolean);

  if (!owedBalances.length) {
    return {
      count: 0,
      totalLabel: "You are settled",
      subtext: "No unpaid amount"
    };
  }

  if (owedBalances.length === 1) {
    const [{ currency, amount }] = owedBalances;
    const formatted = formatMoney(amount, currency);
    return {
      count: liabilityBills.length || 1,
      totalLabel: formatted,
      subtext: `${formatted} owed`
    };
  }

  const preview = owedBalances[0];
  return {
    count: liabilityBills.length || owedBalances.length,
    totalLabel: `${owedBalances.length} currencies owed`,
    subtext: `Includes ${formatMoney(preview.amount, preview.currency)} + more`
  };
}

function formatMoney(amount, currency = "USD") {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "No bills yet";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function notify(message, isError = false) {
  if (typeof window.showToast === "function") {
    window.showToast(message, isError ? "error" : "success");
    return;
  }

  window.alert(message);
}
