const token = localStorage.getItem("accessToken");
if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

const logoutBtn = document.getElementById("logoutBtn");
const calendarScroller = document.getElementById("calendarScroller");
const agendaList = document.getElementById("agendaList");
const agendaTitle = document.getElementById("agendaTitle");
const agendaSubtitle = document.getElementById("agendaSubtitle");
const unscheduledCountLabel = document.getElementById("unscheduledCountLabel");
const viewModeHint = document.getElementById("viewModeHint");

const addChoreBtn = document.getElementById("addChoreBtn");
const choreTitleInput = document.getElementById("choreName");
const choreDueDateInput = document.getElementById("choreDueDate");
const choreAssigneeSelect = document.getElementById("choreAssignee");

const allChoresBtn = document.getElementById("allChoresBtn");
const myChoresBtn = document.getElementById("myChoresBtn");
const recurringChoresBtn = document.getElementById("recurringChoresBtn");
const jumpToTodayBtn = document.getElementById("jumpToTodayBtn");
const unscheduledBtn = document.getElementById("unscheduledBtn");

const groupId = localStorage.getItem("groupId");
const MONTHS_BACK = 2;
const MONTHS_FORWARD = 9;
const UNSCHEDULED_KEY = "UNSCHEDULED";

let currentUser = null;
let currentMembers = [];
let currentView = "all";
let choresCache = [];
let choresByDate = new Map();
let unscheduledChores = [];
let selectedDateKey = toDateKey(new Date());
let hasInitialMonthAligned = false;

logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

allChoresBtn?.addEventListener("click", () => {
  setView("all");
});

myChoresBtn?.addEventListener("click", () => {
  setView("mine");
});

recurringChoresBtn?.addEventListener("click", () => {
  notify("Recurring chores will be added when backend support is ready.", true);
});

jumpToTodayBtn?.addEventListener("click", () => {
  selectedDateKey = toDateKey(new Date());
  renderCalendarAndAgenda();
  scrollToSelectedMonth("smooth");
});

unscheduledBtn?.addEventListener("click", () => {
  selectedDateKey = UNSCHEDULED_KEY;
  renderCalendarAndAgenda();
});

calendarScroller?.addEventListener("click", (event) => {
  const dateButton = event.target.closest("[data-date-key]");
  if (!dateButton) {
    return;
  }

  selectedDateKey = dateButton.getAttribute("data-date-key") || toDateKey(new Date());
  renderCalendarAndAgenda();
});

if (!groupId) {
  renderNoGroupState();
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

    await loadMembersForAssign();
    await loadChores();
  } catch (error) {
    calendarScroller.innerHTML = `<div class="empty-box">${error.message || "Failed to load chores."}</div>`;
    agendaList.innerHTML = "";
  }
}

function renderNoGroupState() {
  if (calendarScroller) {
    calendarScroller.innerHTML = '<div class="empty-box">No group found.</div>';
  }
  if (agendaList) {
    agendaList.innerHTML = "";
  }
}

function setView(nextView) {
  if (currentView === nextView) {
    return;
  }

  currentView = nextView;

  allChoresBtn?.classList.toggle("active", nextView === "all");
  myChoresBtn?.classList.toggle("active", nextView === "mine");

  loadChores();
}

async function loadMembersForAssign() {
  try {
    const data = await apiRequest(`/groups/${groupId}/members`, "GET");
    currentMembers = data.members || [];

    choreAssigneeSelect.innerHTML = '<option value="">Assign to...</option>';

    currentMembers.forEach((member, index) => {
      const displayName = getMemberOptionName(member.userId, index);
      choreAssigneeSelect.innerHTML += `
        <option value="${member.userId}">
          ${displayName} (${member.role})
        </option>
      `;
    });
  } catch {
    choreAssigneeSelect.innerHTML = '<option value="">Assign to...</option>';
  }
}

function getMemberOptionName(userId, fallbackIndex = 0) {
  if (userId === currentUser?.id) {
    const emailName = currentUser.email ? currentUser.email.split("@")[0] : "You";
    return currentUser.fullName || currentUser.name || emailName;
  }

  return `Roommate ${fallbackIndex + 1}`;
}

async function loadChores() {
  try {
    let endpoint = `/groups/${groupId}/chores`;

    if (currentView === "mine" && currentUser?.id) {
      endpoint += `?assigneeUserId=${encodeURIComponent(currentUser.id)}`;
    }

    const data = await apiRequest(endpoint, "GET");
    let chores = Array.isArray(data.chores) ? data.chores : [];

    if (currentView === "mine" && currentUser?.id) {
      chores = chores.filter((chore) => chore.assignedToUserId === currentUser.id);
    }

    choresCache = sortChores(chores);
    rebuildDateMaps();
    ensureSelectedDateKey();
    renderCalendarAndAgenda();

    if (!hasInitialMonthAligned) {
      scrollToSelectedMonth("auto");
      hasInitialMonthAligned = true;
    }
  } catch (error) {
    calendarScroller.innerHTML = `<div class="empty-box">${error.message || "Failed to load chores."}</div>`;
    agendaList.innerHTML = "";
  }
}

function rebuildDateMaps() {
  choresByDate = new Map();
  unscheduledChores = [];

  choresCache.forEach((chore) => {
    const key = getChoreDateKey(chore);
    if (!key) {
      unscheduledChores.push(chore);
      return;
    }

    if (!choresByDate.has(key)) {
      choresByDate.set(key, []);
    }

    choresByDate.get(key).push(chore);
  });

  choresByDate.forEach((items) => {
    items.sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  });
}

function ensureSelectedDateKey() {
  if (selectedDateKey === UNSCHEDULED_KEY) {
    if (unscheduledChores.length) {
      return;
    }
    selectedDateKey = toDateKey(new Date());
    return;
  }

  if (!selectedDateKey) {
    selectedDateKey = toDateKey(new Date());
    return;
  }

  const parsed = parseDateKey(selectedDateKey);
  if (Number.isNaN(parsed.getTime())) {
    selectedDateKey = toDateKey(new Date());
  }
}

function renderCalendarAndAgenda() {
  renderViewModeCopy();
  renderMonthScroller();
  renderAgenda();
  bindChoreActions();
}

function renderViewModeCopy() {
  if (!viewModeHint) {
    return;
  }

  viewModeHint.textContent =
    currentView === "mine"
      ? "Showing chores assigned to you."
      : "Showing chores for the whole household.";
}

function renderMonthScroller() {
  if (!calendarScroller) {
    return;
  }

  const monthStarts = getVisibleMonthStarts();
  const markup = monthStarts.map((monthStart) => renderMonthBlock(monthStart)).join("");

  calendarScroller.innerHTML = markup;
  updateUnscheduledLabel();
}

function updateUnscheduledLabel() {
  if (!unscheduledCountLabel) {
    return;
  }

  const count = unscheduledChores.length;
  unscheduledCountLabel.textContent = count ? `No date (${count})` : "No date";
  unscheduledBtn?.classList.toggle("is-selected", selectedDateKey === UNSCHEDULED_KEY);
}

function getVisibleMonthStarts() {
  const anchor = selectedDateKey && selectedDateKey !== UNSCHEDULED_KEY
    ? parseDateKey(selectedDateKey)
    : new Date();

  const starts = [];
  for (let offset = -MONTHS_BACK; offset <= MONTHS_FORWARD; offset += 1) {
    starts.push(new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1));
  }
  return starts;
}

function renderMonthBlock(monthStart) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7;

  const weekdayCells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((dayName) => `<span class="weekday-name">${dayName}</span>`)
    .join("");

  const blankCells = Array.from({ length: leading })
    .map(() => '<span class="day-blank" aria-hidden="true"></span>')
    .join("");

  const dayCells = Array.from({ length: daysInMonth })
    .map((_, index) => renderDayCell(new Date(year, month, index + 1)))
    .join("");

  return `
    <section class="month-card" data-month-key="${monthKey}">
      <div class="month-head">
        <h3>${monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
      </div>

      <div class="month-weekdays">${weekdayCells}</div>
      <div class="month-grid">
        ${blankCells}
        ${dayCells}
      </div>
    </section>
  `;
}

function renderDayCell(date) {
  const dateKey = toDateKey(date);
  const dayItems = choresByDate.get(dateKey) || [];
  const isSelected = selectedDateKey === dateKey;
  const isToday = dateKey === toDateKey(new Date());
  const hasMine = dayItems.some(
    (chore) => chore.assignedToUserId === currentUser?.id && chore.status !== "COMPLETED"
  );

  const classes = ["day-cell"];
  if (isSelected) {
    classes.push("is-selected");
  }
  if (isToday) {
    classes.push("is-today");
  }
  if (dayItems.length) {
    classes.push("has-chores");
    classes.push(`tone-${getDayTone(dateKey, dayItems)}`);
  }
  if (hasMine) {
    classes.push("has-mine");
  }

  const previewText = getDayPreviewText(dayItems);

  return `
    <button class="${classes.join(" ")}" type="button" data-date-key="${dateKey}">
      <span class="day-top">
        <span class="day-number">${date.getDate()}</span>
        ${dayItems.length ? `<span class="day-count">${dayItems.length}</span>` : ""}
      </span>
      ${previewText ? `<span class="day-preview">${escapeHtml(previewText)}</span>` : ""}
      ${renderDayStatusBar(dateKey, dayItems, hasMine)}
    </button>
  `;
}

function getDayTone(dateKey, choresForDay) {
  const pending = choresForDay.filter((chore) => chore.status !== "COMPLETED");
  if (!pending.length) {
    return "complete";
  }

  const todayKey = toDateKey(new Date());
  if (dateKey < todayKey) {
    return "overdue";
  }
  if (dateKey === todayKey) {
    return "today";
  }

  const diffDays = Math.round((parseDateKey(dateKey) - parseDateKey(todayKey)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) {
    return "soon";
  }

  return "upcoming";
}

function getDayPreviewText(choresForDay) {
  if (!choresForDay.length) {
    return "";
  }

  const myPending = choresForDay.find(
    (chore) => chore.assignedToUserId === currentUser?.id && chore.status !== "COMPLETED"
  );
  if (myPending) {
    return `You: ${myPending.title}`;
  }

  const pending = choresForDay.find((chore) => chore.status !== "COMPLETED");
  if (pending) {
    return pending.title;
  }

  const myCompleted = choresForDay.find((chore) => chore.assignedToUserId === currentUser?.id);
  if (myCompleted) {
    return `You: ${myCompleted.title}`;
  }

  return choresForDay[0].title;
}

function renderDayStatusBar(dateKey, choresForDay, hasMine) {
  if (!choresForDay.length) {
    return "";
  }

  const pending = choresForDay.filter((chore) => chore.status !== "COMPLETED");
  const tone = pending.length ? getDayTone(dateKey, choresForDay) : "complete";

  return `
    <span class="day-status-bar tone-${tone} ${hasMine ? "has-mine" : ""}" aria-hidden="true">
      <span class="day-status-fill"></span>
    </span>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAgenda() {
  if (!agendaList || !agendaTitle || !agendaSubtitle) {
    return;
  }

  const visibleChores = getSelectedAgendaChores();

  if (selectedDateKey === UNSCHEDULED_KEY) {
    agendaTitle.textContent = "No-date chores";
    agendaSubtitle.textContent =
      currentView === "mine"
        ? "Chores assigned to you that have no due date."
        : "Household chores without due dates yet.";
  } else {
    agendaTitle.textContent = `Chores for ${formatDateKeyLong(selectedDateKey)}`;
    agendaSubtitle.textContent =
      currentView === "mine"
        ? "Only chores assigned to you are shown here."
        : "Select another date above to change this list.";
  }

  if (!choresCache.length) {
    agendaList.innerHTML = '<div class="empty-box">No chores yet. Add one above to get started.</div>';
    return;
  }

  if (!visibleChores.length) {
    agendaList.innerHTML = '<div class="empty-box">No chores for this selection.</div>';
    return;
  }

  agendaList.innerHTML = visibleChores.map((chore) => renderAgendaCard(chore)).join("");
}

function getSelectedAgendaChores() {
  if (selectedDateKey === UNSCHEDULED_KEY) {
    return sortChores(unscheduledChores);
  }

  const choresForDay = choresByDate.get(selectedDateKey) || [];
  return sortChores(choresForDay);
}

function renderAgendaCard(chore) {
  const assigneeName = getMemberName(chore.assignedToUserId);
  const dueText = chore.dueDate ? new Date(chore.dueDate).toLocaleString() : "No due date";
  const dueStatusBadge = getDueStatusBadge(chore);

  return `
    <article class="agenda-chore-card">
      <div class="chore-top">
        <div>
          <p class="calendar-time">${dueText}</p>
          <h3 class="chore-title">
            ${chore.title}
            ${dueStatusBadge}
          </h3>
        </div>
        <span class="status-badge ${chore.status === "COMPLETED" ? "status-completed" : "status-pending"}">
          ${chore.status}
        </span>
      </div>

      <p class="chore-meta">${chore.description || "No description"}</p>
      <p class="chore-meta"><strong>Assigned to:</strong> ${assigneeName}</p>

      <div class="chore-actions">
        <select class="assign-select" data-id="${chore.id}">
          <option value="">Assign to...</option>
          ${buildAssignOptions(chore.assignedToUserId)}
        </select>
        <button class="assign-btn" data-id="${chore.id}">Save</button>
        ${chore.status !== "COMPLETED" ? `<button class="complete-btn" data-id="${chore.id}">Complete</button>` : ""}
        <button class="delete-btn" data-id="${chore.id}">Delete</button>
      </div>
    </article>
  `;
}

function bindChoreActions() {
  document.querySelectorAll(".assign-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const choreId = btn.dataset.id;
      const select = document.querySelector(`.assign-select[data-id="${choreId}"]`);
      const assigneeUserId = select?.value || null;

      try {
        await apiRequest(`/chores/${choreId}/assign`, "PATCH", {
          assigneeUserId
        });

        notify("Chore assignment updated.");
        await loadChores();
      } catch (error) {
        notify(error.message || "Failed to assign chore.", true);
      }
    });
  });

  document.querySelectorAll(".complete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const choreId = btn.dataset.id;

      try {
        await apiRequest(`/chores/${choreId}/complete`, "PATCH");
        notify("Chore marked complete.");
        await loadChores();
      } catch (error) {
        notify(error.message || "Failed to complete chore.", true);
      }
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const choreId = btn.dataset.id;
      if (!choreId) {
        return;
      }

      const shouldDelete = window.confirm(
        "Delete this chore permanently? This should remove it from the database."
      );
      if (!shouldDelete) {
        return;
      }

      try {
        await apiRequest(`/chores/${choreId}`, "DELETE");
        notify("Chore deleted.");
        await loadChores();
      } catch (error) {
        notify(getDeleteErrorMessage(error), true);
      }
    });
  });
}

function getDeleteErrorMessage(error) {
  const raw = (error?.message || "").trim();
  const message = raw.toLowerCase();

  if (
    message.includes("cannot delete") ||
    message.includes("not found") ||
    message.includes("invalid response from server")
  ) {
    return "Delete is not enabled in backend yet. Ask backend to add DELETE /api/v1/chores/:choreId.";
  }

  return raw || "Failed to delete chore.";
}

function buildAssignOptions(selectedUserId) {
  return currentMembers
    .map((member, index) => {
      const displayName = getMemberOptionName(member.userId, index);
      return `
        <option value="${member.userId}" ${selectedUserId === member.userId ? "selected" : ""}>
          ${displayName} (${member.role})
        </option>
      `;
    })
    .join("");
}

function getMemberName(userId) {
  if (!userId) {
    return "Unassigned";
  }

  if (userId === currentUser?.id) {
    const emailName = currentUser.email ? currentUser.email.split("@")[0] : "You";
    return currentUser.fullName || currentUser.name || emailName;
  }

  const index = currentMembers.findIndex((member) => member.userId === userId);
  if (index >= 0) {
    return `Roommate ${index + 1}`;
  }

  return "Assigned member";
}

function getDueStatusBadge(chore) {
  if (!chore.dueDate || chore.status === "COMPLETED") {
    return "";
  }

  const now = new Date();
  const dueDate = new Date(chore.dueDate);
  const diffMs = dueDate - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return '<span class="due-badge overdue-badge">Overdue</span>';
  }

  if (diffDays <= 2) {
    return '<span class="due-badge due-soon-badge">Due Soon</span>';
  }

  return "";
}

function sortChores(chores) {
  return [...chores].sort((a, b) => {
    const aPriority = getChorePriority(a);
    const bPriority = getChorePriority(b);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

function getChorePriority(chore) {
  if (chore.status === "COMPLETED") {
    return 3;
  }

  if (!chore.dueDate) {
    return 2;
  }

  const now = new Date();
  const dueDate = new Date(chore.dueDate);
  const diffMs = dueDate - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return 0;
  }

  if (diffDays <= 2) {
    return 1;
  }

  return 2;
}

function getChoreDateKey(chore) {
  if (!chore.dueDate) {
    return null;
  }

  const date = new Date(chore.dueDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return toDateKey(date);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKeyLong(dateKey) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function scrollToSelectedMonth(behavior = "smooth") {
  if (!calendarScroller || selectedDateKey === UNSCHEDULED_KEY) {
    return;
  }

  const selectedDate = parseDateKey(selectedDateKey);
  const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`;
  const monthCard = calendarScroller.querySelector(`[data-month-key="${monthKey}"]`);
  if (!monthCard) {
    return;
  }

  const scrollerRect = calendarScroller.getBoundingClientRect();
  const cardRect = monthCard.getBoundingClientRect();
  const currentTop = calendarScroller.scrollTop;
  const nextTop = Math.max(currentTop + (cardRect.top - scrollerRect.top) - 6, 0);

  calendarScroller.scrollTo({
    top: nextTop,
    behavior
  });
}

function notify(message, isError = false) {
  if (typeof window.showToast === "function") {
    window.showToast(message, isError ? "error" : "success");
    return;
  }

  window.alert(message);
}

addChoreBtn?.addEventListener("click", async () => {
  const title = choreTitleInput.value.trim();
  const dueDate = choreDueDateInput.value;
  const assigneeUserId = choreAssigneeSelect.value;

  if (!title) {
    notify("Please enter a chore title.", true);
    return;
  }

  const payload = { title };

  if (dueDate) {
    payload.dueDate = new Date(dueDate).toISOString();
  }

  if (assigneeUserId) {
    payload.assigneeUserId = assigneeUserId;
  }

  try {
    await apiRequest(`/groups/${groupId}/chores`, "POST", payload);

    choreTitleInput.value = "";
    choreDueDateInput.value = "";
    choreAssigneeSelect.value = "";

    notify("Chore added.");
    await loadChores();
  } catch (error) {
    notify(error.message || "Failed to add chore.", true);
  }
});
