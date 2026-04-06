const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

const billsList = document.getElementById("billsList");
const balancesList = document.getElementById("balancesList");
const settlementsList = document.getElementById("settlementsList");

const addBillBtn = document.getElementById("addBillBtn");
const billTitleInput = document.getElementById("billTitle");
const billDescriptionInput = document.getElementById("billDescription");
const billAmountInput = document.getElementById("billAmount");
const paidBySelect = document.getElementById("paidBySelect");

const addPaymentBtn = document.getElementById("addPaymentBtn");
const paymentPayer = document.getElementById("paymentPayer");
const paymentPayee = document.getElementById("paymentPayee");
const paymentAmount = document.getElementById("paymentAmount");
const paymentNote = document.getElementById("paymentNote");

let currentUser = null;
let currentMembers = [];
let latestBalances = [];
let latestSettlements = [];

const groupId = localStorage.getItem("groupId");

if (!groupId) {
  billsList.innerHTML = `<div class="empty-box">No group found.</div>`;
} else {
  initializePage();
}

async function initializePage() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    currentUser = userData.user || userData || {};

    const emailName = currentUser.email ? currentUser.email.split("@")[0] : "User";
    const userName = currentUser.fullName || currentUser.name || emailName;
    document.getElementById("userNameDisplay").textContent = userName;

    await loadMembers();
    await loadBalances();
    await loadBills();
  } catch (err) {
    billsList.innerHTML = `<div class="empty-box">${err.message || "Failed to load page."}</div>`;
  }
}

async function loadMembers() {
  try {
    const data = await apiRequest(`/groups/${groupId}/members`, "GET");
    currentMembers = data.members || [];

    paidBySelect.innerHTML = `<option value="">Paid by...</option>`;
    paymentPayer.innerHTML = `<option value="">Payer...</option>`;
    paymentPayee.innerHTML = `<option value="">Payee...</option>`;

    currentMembers.forEach((member, index) => {
      const label = getMemberDisplayName(member.userId, index);
      const optionHtml = `<option value="${member.userId}">${label} (${member.role})</option>`;

      paidBySelect.innerHTML += optionHtml;
      paymentPayer.innerHTML += optionHtml;
      paymentPayee.innerHTML += optionHtml;
    });

    if (currentUser?.id) {
      paidBySelect.value = currentUser.id;
      paymentPayer.value = currentUser.id;
    }
  } catch (err) {
    console.error(err);
  }
}

function getMemberDisplayName(userId, fallbackIndex = 0) {
  if (userId === currentUser?.id) {
    const emailName = currentUser.email ? currentUser.email.split("@")[0] : "You";
    return currentUser.fullName || currentUser.name || emailName;
  }

  const index = currentMembers.findIndex((m) => m.userId === userId);
  if (index >= 0) return `Roommate ${index + 1}`;

  return `Roommate ${fallbackIndex + 1}`;
}

async function loadBalances() {
  try {
    const data = await apiRequest(`/groups/${groupId}/balances`, "GET");
    const balances = data.balances || [];

    latestBalances = balances;
    latestSettlements = balances.flatMap((b) =>
      (b.settlements || []).map((s) => ({
        ...s,
        currency: b.currency
      }))
    );

    if (!balances.length) {
      balancesList.innerHTML = `<div class="empty-box">No balances yet.</div>`;
      settlementsList.innerHTML = "";
      return;
    }

    balancesList.innerHTML = balances.map((currencyBlock) => {
      const memberBalances = currencyBlock.memberBalances || [];

      return `
        <div class="balance-card">
          <h3>${currencyBlock.currency}</h3>
          ${memberBalances.map((balance) => `
            <div class="balance-row">
              <span>${getMemberDisplayName(balance.userId)}</span>
              <strong>${formatMoney(balance.netAmount, currencyBlock.currency)}</strong>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");

    if (!latestSettlements.length) {
      settlementsList.innerHTML = `<div class="empty-box">No settlements needed right now.</div>`;
      return;
    }

    settlementsList.innerHTML = latestSettlements.map((settlement) => `
      <div class="settlement-card">
        <div class="balance-row">
          <span>${getMemberDisplayName(settlement.fromUserId)} pays ${getMemberDisplayName(settlement.toUserId)}</span>
          <strong>${formatMoney(settlement.amount, settlement.currency)}</strong>
        </div>
      </div>
    `).join("");
  } catch (err) {
    balancesList.innerHTML = `<div class="empty-box">${err.message || "Failed to load balances."}</div>`;
    settlementsList.innerHTML = "";
  }
}

async function loadBills() {
  try {
    const data = await apiRequest(`/groups/${groupId}/bills?sortBy=createdAt&sortOrder=desc`, "GET");
    const bills = data.bills || [];

    if (!bills.length) {
      billsList.innerHTML = `<div class="empty-box">No bills added yet.</div>`;
      return;
    }

    billsList.innerHTML = bills.map((bill) => {
      const paidByName = getMemberDisplayName(bill.paidByUserId);

      return `
        <div class="bill-card">
          <div class="bill-title-row">
            <div>
              <h3 class="bill-title">${bill.title}</h3>
            </div>
            <span class="amount-pill">$${Number(bill.totalAmount).toFixed(2)}</span>
          </div>

          <p class="bill-meta">${bill.description || "No description"}</p>
          <p class="bill-meta"><strong>Paid by:</strong> ${paidByName}</p>
          <p class="bill-meta"><strong>Created:</strong> ${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : "N/A"}</p>

          <div class="bill-row">
            <span>Currency</span>
            <strong>${bill.currency || "USD"}</strong>
          </div>

          <div class="bill-row">
            <span>Split count</span>
            <strong>${bill.splits ? bill.splits.length : 0}</strong>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    billsList.innerHTML = `<div class="empty-box">${err.message || "Failed to load bills."}</div>`;
  }
}

function areAllBalancesZero() {
  if (!latestBalances.length) return false;

  return latestBalances.every((currencyBlock) =>
    (currencyBlock.memberBalances || []).every(
      (memberBalance) => Number(memberBalance.netAmount) === 0
    )
  );
}


function formatMoney(amount, currency = "USD") {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function buildEqualSplits(totalAmount) {
  const activeMembers = currentMembers.filter((m) => m.status === "ACTIVE");

  if (!activeMembers.length) return [];

  const totalCents = Math.round(Number(totalAmount) * 100);
  const base = Math.floor(totalCents / activeMembers.length);
  const remainder = totalCents % activeMembers.length;

  return activeMembers.map((member, index) => ({
    userId: member.userId,
    amount: (base + (index < remainder ? 1 : 0)) / 100
  }));
}

addBillBtn?.addEventListener("click", async () => {
  const title = billTitleInput.value.trim();
  const description = billDescriptionInput.value.trim();
  const amount = parseFloat(billAmountInput.value.trim());
  const paidByUserId = paidBySelect.value;

  if (!title || isNaN(amount) || amount <= 0 || !paidByUserId) {
    alert("Please fill in title, amount, and paid by.");
    return;
  }

  const splits = buildEqualSplits(amount);

  if (!splits.length) {
    alert("No active members found to split this bill.");
    return;
  }

  const payload = {
    title,
    description,
    totalAmount: amount,
    paidByUserId,
    splits
  };

  try {
    await apiRequest(`/groups/${groupId}/bills`, "POST", payload);

    billTitleInput.value = "";
    billDescriptionInput.value = "";
    billAmountInput.value = "";
    paidBySelect.value = currentUser?.id || "";

    await loadBalances();
    await loadBills();
  } catch (err) {
    alert(err.message || "Failed to add bill.");
  }
});

addPaymentBtn?.addEventListener("click", async () => {
  const payerUserId = paymentPayer.value;
  const payeeUserId = paymentPayee.value;
  const amount = parseFloat(paymentAmount.value.trim());
  const note = paymentNote.value.trim();

  if (!payerUserId || !payeeUserId || payerUserId === payeeUserId || isNaN(amount) || amount <= 0) {
    alert("Please enter valid payment details.");
    return;
  }

  const payload = {
    payerUserId,
    payeeUserId,
    amount
  };

  if (note) {
    payload.note = note;
  }

  try {
    await apiRequest(`/groups/${groupId}/payments`, "POST", payload);

    paymentPayer.value = currentUser?.id || "";
    paymentPayee.value = "";
    paymentAmount.value = "";
    paymentNote.value = "";

    await loadBalances();
    await loadBills();
  } catch (err) {
    alert(err.message || "Failed to record payment.");
  }
});