const token = localStorage.getItem('accessToken');
if (!token) {
  window.location.href = '/samia_frontend/auth/login.html';
}

const groupId = localStorage.getItem('groupId');

const billsList = document.getElementById('billsList');
const balancesList = document.getElementById('balancesList');
const settlementsList = document.getElementById('settlementsList');

const openAddExpenseBtn = document.getElementById('openAddExpenseBtn');
const openSettleUpBtn = document.getElementById('openSettleUpBtn');

const addExpenseModal = document.getElementById('addExpenseModal');
const settleUpModal = document.getElementById('settleUpModal');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');

const cancelAddExpenseBtn = document.getElementById('cancelAddExpenseBtn');
const cancelSettleUpBtn = document.getElementById('cancelSettleUpBtn');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

const addBillBtn = document.getElementById('addBillBtn');
const billTitleInput = document.getElementById('billTitle');
const billDescriptionInput = document.getElementById('billDescription');
const billAmountInput = document.getElementById('billAmount');
const paidBySelect = document.getElementById('paidBySelect');

const addPaymentBtn = document.getElementById('addPaymentBtn');
const paymentPayer = document.getElementById('paymentPayer');
const paymentPayee = document.getElementById('paymentPayee');
const paymentAmount = document.getElementById('paymentAmount');
const paymentNote = document.getElementById('paymentNote');

const selectedMembersWrap = document.getElementById('selectedMembersWrap');
const selectedMembersList = document.getElementById('selectedMembersList');
const splitModeInputs = document.querySelectorAll('input[name="splitMode"]');

const deleteConfirmTitle = document.getElementById('deleteConfirmTitle');
const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');

const logoutBtn = document.getElementById('logoutBtn');
logoutBtn?.addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/samia_frontend/auth/login.html';
});

let currentUser = null;
let currentMembers = [];
let allBills = [];
let pendingDeleteAction = null;

openAddExpenseBtn?.addEventListener('click', () => {
  resetAddExpenseForm();
  openModal(addExpenseModal);
});

openSettleUpBtn?.addEventListener('click', () => {
  resetSettleForm();
  openModal(settleUpModal);
});

cancelAddExpenseBtn?.addEventListener('click', () => closeModal(addExpenseModal));
cancelSettleUpBtn?.addEventListener('click', () => closeModal(settleUpModal));
deleteCancelBtn?.addEventListener('click', () => closeDeleteConfirm());

deleteConfirmBtn?.addEventListener('click', async () => {
  if (!pendingDeleteAction) {
    closeDeleteConfirm();
    return;
  }

  const action = pendingDeleteAction;
  closeDeleteConfirm();
  await action();
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-close');
    const modal = document.getElementById(targetId);
    closeModal(modal);
  });
});

[addExpenseModal, settleUpModal, deleteConfirmModal].forEach((modal) => {
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAllModals();
  }
});

splitModeInputs.forEach((input) => {
  input.addEventListener('change', updateSplitModeUI);
});

if (!groupId) {
  billsList.innerHTML = '<div class="empty-box">No group selected yet.</div>';
  disableActions();
} else {
  initializePage();
}

async function initializePage() {
  try {
    const userData = await apiRequest('/auth/me', 'GET');
    currentUser = userData.user || userData || {};

    const emailName = currentUser.email ? currentUser.email.split('@')[0] : 'User';
    const userName = currentUser.fullName || currentUser.name || emailName;
    document.getElementById('userNameDisplay').textContent = userName;

    await loadMembers();
    await loadBalances();
    await loadBills();
  } catch (error) {
    billsList.innerHTML = `<div class="empty-box">${error.message || 'Failed to load expenses.'}</div>`;
  }
}

async function loadMembers() {
  const data = await apiRequest(`/groups/${groupId}/members`, 'GET');
  currentMembers = data.members || [];

  populateMemberSelect(paidBySelect, 'Paid by...');
  populateMemberSelect(paymentPayer, 'Payer...');
  populateMemberSelect(paymentPayee, 'Payee...');
  renderSelectableSplitMembers();

  if (currentUser?.id) {
    paidBySelect.value = currentUser.id;
    paymentPayer.value = currentUser.id;
  }
}

function populateMemberSelect(selectEl, placeholder) {
  if (!selectEl) return;

  const options = [`<option value="">${placeholder}</option>`];

  currentMembers.forEach((member, index) => {
    const label = `${getMemberDisplayName(member.userId, index)} (${member.role})`;
    options.push(`<option value="${member.userId}">${label}</option>`);
  });

  selectEl.innerHTML = options.join('');
}

function renderSelectableSplitMembers() {
  const activeMembers = getActiveMembers();

  if (!activeMembers.length) {
    selectedMembersList.innerHTML = '<p class="small-note">No active members available.</p>';
    return;
  }

  selectedMembersList.innerHTML = activeMembers
    .map(
      (member, index) => `
        <label class="member-chip">
          <input type="checkbox" value="${member.userId}" checked />
          <span>${getMemberDisplayName(member.userId, index)}</span>
        </label>
      `
    )
    .join('');
}

function getMemberDisplayName(userId, fallbackIndex = 0) {
  if (userId === currentUser?.id) {
    const emailName = currentUser.email ? currentUser.email.split('@')[0] : 'You';
    return currentUser.fullName || currentUser.name || emailName;
  }

  const memberIndex = currentMembers.findIndex((member) => member.userId === userId);
  if (memberIndex >= 0) {
    return `Roommate ${memberIndex + 1}`;
  }

  return `Roommate ${fallbackIndex + 1}`;
}

function getActiveMembers() {
  return currentMembers.filter((member) => member.status === 'ACTIVE');
}

async function loadBalances() {
  try {
    const data = await apiRequest(`/groups/${groupId}/balances`, 'GET');
    const balances = data.balances || [];

    if (!balances.length) {
      balancesList.innerHTML = '<div class="empty-box compact-empty">No balances yet.</div>';
      settlementsList.innerHTML = '<div class="empty-box compact-empty">No settlements yet.</div>';
      return;
    }

    balancesList.innerHTML = balances
      .map((currencyBlock) => {
        const memberRows = (currencyBlock.memberBalances || [])
          .map((entry) => {
            const amount = Number(entry.netAmount);
            const amountClass = amount >= 0 ? 'amount-positive' : 'amount-negative';
            return `
              <div class="balance-row">
                <span>${getMemberDisplayName(entry.userId)}</span>
                <strong class="${amountClass}">${formatMoney(amount, currencyBlock.currency)}</strong>
              </div>
            `;
          })
          .join('');

        return `
          <article class="balance-card">
            <h3>${currencyBlock.currency}</h3>
            ${memberRows}
          </article>
        `;
      })
      .join('');

    const settlements = balances.flatMap((currencyBlock) =>
      (currencyBlock.settlements || []).map((settlement) => ({
        ...settlement,
        currency: currencyBlock.currency
      }))
    );

    if (!settlements.length) {
      settlementsList.innerHTML = '<div class="empty-box compact-empty">No settlements needed right now.</div>';
      return;
    }

    settlementsList.innerHTML = settlements
      .map(
        (settlement) => `
          <article class="settlement-card">
            <p>${getMemberDisplayName(settlement.fromUserId)} pays ${getMemberDisplayName(settlement.toUserId)}</p>
            <strong>${formatMoney(settlement.amount, settlement.currency)}</strong>
          </article>
        `
      )
      .join('');
  } catch (error) {
    balancesList.innerHTML = `<div class="empty-box compact-empty">${error.message || 'Failed to load balances.'}</div>`;
    settlementsList.innerHTML = '';
  }
}

async function loadBills() {
  try {
    const data = await apiRequest(`/groups/${groupId}/bills?sortBy=createdAt&sortOrder=desc`, 'GET');
    allBills = data.bills || [];

    if (!allBills.length) {
      billsList.innerHTML = '<div class="empty-box">No expenses yet. Click Add an expense to create your first bill.</div>';
      return;
    }

    billsList.innerHTML = renderBillsTimeline(allBills);
    bindBillDeleteButtons();
  } catch (error) {
    billsList.innerHTML = `<div class="empty-box">${error.message || 'Failed to load bills.'}</div>`;
  }
}

function renderBillsTimeline(bills) {
  const sortedBills = [...bills].sort((a, b) => getBillDate(b) - getBillDate(a));
  const buckets = new Map();

  sortedBills.forEach((bill) => {
    const date = getBillDate(bill);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();

    if (!buckets.has(key)) {
      buckets.set(key, { label, items: [] });
    }

    buckets.get(key).items.push(bill);
  });

  return Array.from(buckets.values())
    .map(
      (bucket) => `
        <section class="month-group">
          <h3 class="month-label">${bucket.label}</h3>
          <div class="month-items">
            ${bucket.items.map((bill) => renderBillRow(bill)).join('')}
          </div>
        </section>
      `
    )
    .join('');
}

function renderBillRow(bill) {
  const date = getBillDate(bill);
  const month = date.toLocaleString(undefined, { month: 'short' }).toUpperCase();
  const day = String(date.getDate()).padStart(2, '0');

  const paidByName = getMemberDisplayName(bill.paidByUserId);
  const splitCount = bill.splits?.length || 0;
  const amountText = formatMoney(bill.totalAmount, bill.currency || 'USD');

  const relationshipText = getRelationshipText(bill);

  return `
    <article class="timeline-row" data-bill-id="${bill.id || ''}">
      <div class="date-tile">
        <span class="date-month">${month}</span>
        <span class="date-day">${day}</span>
      </div>

      <div class="expense-content">
        <h4>${bill.title}</h4>
        <p>${bill.description || 'No description'}</p>
        <p class="expense-meta">Paid by ${paidByName} · Split among ${splitCount} member${splitCount === 1 ? '' : 's'}</p>
      </div>

      <div class="expense-amount">
        <span class="expense-relation">${relationshipText}</span>
        <strong>${amountText}</strong>
      </div>

      <button class="icon-btn delete-bill-btn" type="button" data-bill-id="${bill.id || ''}" aria-label="Delete expense">
        <i class="fa-solid fa-trash"></i>
      </button>
    </article>
  `;
}

function getRelationshipText(bill) {
  if (!currentUser?.id) return 'Group expense';

  if (bill.paidByUserId === currentUser.id) {
    return 'You paid';
  }

  const mySplit = (bill.splits || []).find((split) => split.userId === currentUser.id);
  if (mySplit) {
    return 'You owe';
  }

  return 'Shared expense';
}

function bindBillDeleteButtons() {
  document.querySelectorAll('.delete-bill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const billId = btn.getAttribute('data-bill-id');
      if (!billId) return;

      openDeleteConfirm({
        title: 'Delete this expense?',
        message: 'This action permanently deletes this expense.',
        confirmText: 'Delete',
        onConfirm: async () => {
          try {
            await apiRequest(`/bills/${billId}`, 'DELETE');
            notify('Expense deleted.');
            await loadBalances();
            await loadBills();
          } catch (error) {
            notify(getBillDeleteErrorMessage(error), true);
          }
        }
      });
    });
  });
}

function getBillDeleteErrorMessage(error) {
  const raw = (error?.message || '').trim();
  const message = raw.toLowerCase();

  if (
    message.includes('cannot delete') ||
    message.includes('not found') ||
    message.includes('invalid response from server: 404') ||
    message.includes('invalid response from server: 405')
  ) {
    return 'Delete bill is not enabled in backend yet. Ask backend to add DELETE /api/v1/bills/:billId.';
  }

  return raw || 'Failed to delete expense.';
}

function openDeleteConfirm({ title, message, confirmText, onConfirm }) {
  deleteConfirmTitle.textContent = title;
  deleteConfirmMessage.textContent = message;
  deleteConfirmBtn.textContent = confirmText;
  pendingDeleteAction = onConfirm;
  openModal(deleteConfirmModal);
}

function closeDeleteConfirm() {
  pendingDeleteAction = null;
  closeModal(deleteConfirmModal);
}

addBillBtn?.addEventListener('click', async () => {
  const title = billTitleInput.value.trim();
  const description = billDescriptionInput.value.trim();
  const amount = parseFloat(billAmountInput.value);
  const paidByUserId = paidBySelect.value;

  if (!title || Number.isNaN(amount) || amount <= 0 || !paidByUserId) {
    notify('Please fill title, amount, and paid by.', true);
    return;
  }

  const splitMembers = getSplitMembersForPayload();
  if (!splitMembers.length) {
    notify('Select at least one member to split with.', true);
    return;
  }

  const splits = buildEqualSplits(amount, splitMembers);

  try {
    await apiRequest(`/groups/${groupId}/bills`, 'POST', {
      title,
      description,
      totalAmount: amount,
      paidByUserId,
      splits
    });

    resetAddExpenseForm();
    closeModal(addExpenseModal);
    notify('Expense added.');

    await loadBalances();
    await loadBills();
  } catch (error) {
    notify(error.message || 'Failed to add expense.', true);
  }
});

addPaymentBtn?.addEventListener('click', async () => {
  const payerUserId = paymentPayer.value;
  const payeeUserId = paymentPayee.value;
  const amount = parseFloat(paymentAmount.value);
  const note = paymentNote.value.trim();

  if (!payerUserId || !payeeUserId || payerUserId === payeeUserId || Number.isNaN(amount) || amount <= 0) {
    notify('Please enter valid payment details.', true);
    return;
  }

  const payload = {
    payerUserId,
    payeeUserId,
    amount,
    ...(note ? { note } : {})
  };

  try {
    await apiRequest(`/groups/${groupId}/payments`, 'POST', payload);

    paymentPayer.value = currentUser?.id || '';
    paymentPayee.value = '';
    paymentAmount.value = '';
    paymentNote.value = '';

    closeModal(settleUpModal);
    notify('Payment recorded.');

    await loadBalances();
    await loadBills();
  } catch (error) {
    notify(error.message || 'Failed to record payment.', true);
  }
});

function getSplitMembersForPayload() {
  const mode = getSplitMode();
  const activeMembers = getActiveMembers();

  if (mode === 'all') {
    return activeMembers;
  }

  const selectedIds = Array.from(
    selectedMembersList.querySelectorAll('input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.value);

  return activeMembers.filter((member) => selectedIds.includes(member.userId));
}

function getSplitMode() {
  const checked = document.querySelector('input[name="splitMode"]:checked');
  return checked ? checked.value : 'all';
}

function updateSplitModeUI() {
  const mode = getSplitMode();
  selectedMembersWrap.classList.toggle('hidden', mode !== 'selected');
}

function buildEqualSplits(totalAmount, members) {
  const totalCents = Math.round(Number(totalAmount) * 100);
  const base = Math.floor(totalCents / members.length);
  const remainder = totalCents % members.length;

  return members.map((member, index) => ({
    userId: member.userId,
    amount: (base + (index < remainder ? 1 : 0)) / 100
  }));
}

function resetAddExpenseForm() {
  billTitleInput.value = '';
  billDescriptionInput.value = '';
  billAmountInput.value = '';
  paidBySelect.value = currentUser?.id || '';

  const allModeInput = document.querySelector('input[name="splitMode"][value="all"]');
  if (allModeInput) {
    allModeInput.checked = true;
  }

  selectedMembersList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = true;
  });

  updateSplitModeUI();
}

function resetSettleForm() {
  paymentPayer.value = currentUser?.id || '';
  paymentPayee.value = '';
  paymentAmount.value = '';
  paymentNote.value = '';
}

function getBillDate(bill) {
  return new Date(bill.incurredAt || bill.createdAt || Date.now());
}

function formatMoney(amount, currency = 'USD') {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function closeAllModals() {
  closeModal(addExpenseModal);
  closeModal(settleUpModal);
  closeModal(deleteConfirmModal);
  pendingDeleteAction = null;
}

function disableActions() {
  [openAddExpenseBtn, openSettleUpBtn].forEach((button) => {
    if (!button) return;
    button.disabled = true;
  });
}

function notify(message, isError = false) {
  if (typeof window.showToast === 'function') {
    window.showToast(message, isError ? 'error' : 'success');
    return;
  }

  window.alert(message);
}