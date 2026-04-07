const token = localStorage.getItem('accessToken');
if (!token) {
	window.location.href = '/samia_frontend/auth/login.html';
}

const logoutBtn = document.getElementById('logoutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');
const groupsGrid = document.getElementById('groupsGrid');

const memberManageHint = document.getElementById('memberManageHint');
const memberActionsList = document.getElementById('memberActionsList');

const deleteGroupBtn = document.getElementById('deleteGroupBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const dangerStatus = document.getElementById('dangerStatus');

const confirmActionModal = document.getElementById('confirmActionModal');
const confirmActionTitle = document.getElementById('confirmActionTitle');
const confirmActionDescription = document.getElementById('confirmActionDescription');
const confirmActionPrompt = document.getElementById('confirmActionPrompt');
const confirmActionInput = document.getElementById('confirmActionInput');
const confirmActionError = document.getElementById('confirmActionError');
const confirmStepOne = document.getElementById('confirmStepOne');
const confirmStepTwo = document.getElementById('confirmStepTwo');
const confirmActionCancelBtn = document.getElementById('confirmActionCancelBtn');
const confirmActionBackBtn = document.getElementById('confirmActionBackBtn');
const confirmActionContinueBtn = document.getElementById('confirmActionContinueBtn');
const confirmActionSubmitBtn = document.getElementById('confirmActionSubmitBtn');

let currentUser = null;
let currentUserName = 'User';
let groups = [];
let currentGroupId = localStorage.getItem('groupId') || '';
let currentGroupRole = null;
let confirmResolver = null;
let confirmPhrase = '';

initializeConfirmationModal();

logoutBtn?.addEventListener('click', () => {
	localStorage.clear();
	window.location.href = '/samia_frontend/auth/login.html';
});

deleteGroupBtn?.addEventListener('click', async () => {
	if (!currentGroupId) {
		notify('No household selected.', true);
		return;
	}

	if (currentGroupRole !== 'ADMIN') {
		notify('Only admins can delete a household.', true);
		return;
	}

	const confirmed = await requireDoubleConfirmation(
		'Delete group',
		'This permanently deletes the active household.',
		'DELETE GROUP',
		'Delete group'
	);
	if (!confirmed) {
		return;
	}

	try {
		await apiRequest(`/groups/${currentGroupId}`, 'DELETE');
		setDangerStatus('Group deleted successfully.', false);
		notify('Group deleted.');

		currentGroupId = '';
		localStorage.removeItem('groupId');

		await loadGroups();
		await loadGroupMembers();
	} catch (error) {
		const message = mapBackendDeleteError(
			error,
			'Delete group is not available in backend yet. Ask backend teammate to add DELETE /api/v1/groups/:groupId (admin-only).'
		);

		setDangerStatus(message, true);
		notify(message, true);
	}
});

deleteAccountBtn?.addEventListener('click', async () => {
	const confirmed = await requireDoubleConfirmation(
		'Delete account',
		'This permanently deletes your account.',
		'DELETE ACCOUNT',
		'Delete account'
	);
	if (!confirmed) {
		return;
	}

	try {
		await apiRequest('/auth/account', 'DELETE');
		localStorage.clear();
		window.location.href = '/samia_frontend/auth/login.html';
	} catch (error) {
		const message = mapBackendDeleteError(
			error,
			'Delete account is not available in backend yet. Ask backend teammate to add DELETE /api/v1/auth/account for the authenticated user.'
		);

		setDangerStatus(message, true);
		notify(message, true);
	}
});

initializePage();

async function initializePage() {
	try {
		const userData = await apiRequest('/auth/me', 'GET');
		currentUser = userData.user || userData || {};

		const emailName = currentUser.email ? currentUser.email.split('@')[0] : 'User';
		currentUserName = currentUser.fullName || currentUser.name || emailName;
		userNameDisplay.textContent = currentUserName;

		await loadGroups();
		await loadGroupMembers();
	} catch (error) {
		groupsGrid.innerHTML = `<div class="empty-state">${error.message || 'Failed to load households.'}</div>`;
		memberActionsList.innerHTML = `<div class="empty-state">${error.message || 'Failed to load members.'}</div>`;
	}
}

async function loadGroups() {
	const data = await apiRequest('/groups', 'GET');
	groups = Array.isArray(data.groups) ? data.groups : [];

	if (!groups.length) {
		currentGroupId = '';
		currentGroupRole = null;
		localStorage.removeItem('groupId');
	} else {
		const hasCurrent = groups.some((group) => group.id === currentGroupId);
		if (!hasCurrent) {
			currentGroupId = groups[0].id;
		}
		localStorage.setItem('groupId', currentGroupId);
	}

	renderGroups();
	updateActiveGroupContext();
}

function renderGroups() {
	const staticCards = `
		<div class="group-card" id="openJoinCard">
			<div class="group-top">
				<div>
					<h2 class="group-name">Join Group</h2>
					<p class="group-card-text">Enter a code to join an existing household.</p>
				</div>
				<div class="group-controls">
					<button class="group-open-btn" type="button" aria-label="Open join form">
						<i class="fa-solid fa-plus"></i>
					</button>
				</div>
			</div>

			<div id="joinPanel" class="inline-panel hidden">
				<div class="action-form">
					<input type="text" id="joinCodeInput" placeholder="Enter join code">
					<button id="joinGroupBtn" class="secondary-btn" type="button">Join Group</button>
				</div>
			</div>
		</div>

		<div class="group-card" id="openCreateCard">
			<div class="group-top">
				<div>
					<h2 class="group-name">Create Group</h2>
					<p class="group-card-text">Create a new household and get a join code.</p>
				</div>
				<div class="group-controls">
					<button class="group-open-btn" type="button" aria-label="Open create form">
						<i class="fa-solid fa-plus"></i>
					</button>
				</div>
			</div>

			<div id="createPanel" class="inline-panel hidden">
				<div class="action-form">
					<input type="text" id="createGroupName" placeholder="Group name">
					<button id="createGroupBtn" class="primary-btn" type="button">Create</button>
				</div>
			</div>
		</div>
	`;

	const householdCards = groups.length
		? groups
				.map((group) => {
					const isActive = group.id === currentGroupId;
					return `
						<div class="group-card clickable ${isActive ? 'is-active' : ''}" data-id="${group.id}">
							<div class="group-top">
								<div>
									<h2 class="group-name">${group.name}</h2>
								</div>

								<div class="group-controls">
									<button
										class="soft-btn use-active-btn ${isActive ? 'is-active' : ''}"
										data-active-id="${group.id}"
										type="button"
									>
										${isActive ? 'Active' : 'Use in settings'}
									</button>

									<button class="group-open-btn" data-open-id="${group.id}" type="button" aria-label="Open dashboard">
										<i class="fa-solid fa-arrow-right"></i>
									</button>
								</div>
							</div>

							<div class="group-meta">
								<span class="meta-pill">${capitalize(group.memberRole || 'Member')}</span>
								<span><i class="fa-solid fa-users"></i> ${group.memberCount ?? 0}</span>
							</div>

							<div class="invite-strip">
								<div class="invite-left">
									<span><i class="fa-solid fa-ticket"></i></span>
									<span>${group.joinCode || 'No Code'}</span>
								</div>
								<button class="copy-code-btn" data-code="${group.joinCode || ''}" type="button" aria-label="Copy join code"></button>
							</div>
						</div>
					`;
				})
				.join('')
		: '<div class="empty-state">No households yet. Create one or join with a code.</div>';

	groupsGrid.innerHTML = staticCards + householdCards;
	bindHouseholdUi();
}

function bindHouseholdUi() {
	bindActionCards();
	bindCreateJoinButtons();
	preventCloseOnInput();
	bindGroupActions();
}

function bindActionCards() {
	const openCreateCard = document.getElementById('openCreateCard');
	const openJoinCard = document.getElementById('openJoinCard');
	const createPanel = document.getElementById('createPanel');
	const joinPanel = document.getElementById('joinPanel');

	openCreateCard?.addEventListener('click', () => {
		createPanel.classList.toggle('hidden');
		joinPanel.classList.add('hidden');
	});

	openJoinCard?.addEventListener('click', () => {
		joinPanel.classList.toggle('hidden');
		createPanel.classList.add('hidden');
	});
}

function preventCloseOnInput() {
	document.getElementById('createPanel')?.addEventListener('click', (event) => event.stopPropagation());
	document.getElementById('joinPanel')?.addEventListener('click', (event) => event.stopPropagation());
}

function bindCreateJoinButtons() {
	const createBtn = document.getElementById('createGroupBtn');
	const joinBtn = document.getElementById('joinGroupBtn');

	createBtn?.addEventListener('click', async (event) => {
		event.stopPropagation();

		const nameInput = document.getElementById('createGroupName');
		const name = nameInput?.value.trim();
		if (!name) {
			notify('Enter group name.', true);
			return;
		}

		try {
			const data = await apiRequest('/groups', 'POST', { name });
			localStorage.setItem('groupId', data.id);
			window.location.href = '/Uddhav_Cota_Frontend/app-shell/app-shell.html';
		} catch (error) {
			notify(error.message || 'Failed to create group.', true);
		}
	});

	joinBtn?.addEventListener('click', async (event) => {
		event.stopPropagation();

		const joinInput = document.getElementById('joinCodeInput');
		const code = joinInput?.value.trim();
		if (!code) {
			notify('Enter invite code.', true);
			return;
		}

		try {
			const data = await apiRequest('/groups/join', 'POST', { joinCode: code });
			localStorage.setItem('groupId', data.id);
			window.location.href = '/Uddhav_Cota_Frontend/app-shell/app-shell.html';
		} catch (error) {
			notify(error.message || 'Failed to join group.', true);
		}
	});
}

function bindGroupActions() {
	document.querySelectorAll('.group-card.clickable').forEach((card) => {
		card.addEventListener('click', (event) => {
			if (event.target.closest('button') || event.target.closest('input')) {
				return;
			}

			const groupId = card.getAttribute('data-id');
			if (!groupId) {
				return;
			}

			openDashboardForGroup(groupId);
		});
	});

	document.querySelectorAll('.group-open-btn[data-open-id]').forEach((button) => {
		button.addEventListener('click', (event) => {
			event.stopPropagation();

			const groupId = button.getAttribute('data-open-id');
			if (!groupId) {
				return;
			}

			openDashboardForGroup(groupId);
		});
	});

	document.querySelectorAll('.use-active-btn[data-active-id]').forEach((button) => {
		button.addEventListener('click', async (event) => {
			event.stopPropagation();

			const groupId = button.getAttribute('data-active-id');
			if (!groupId) {
				return;
			}

			currentGroupId = groupId;
			localStorage.setItem('groupId', currentGroupId);
			clearDangerStatus();

			renderGroups();
			updateActiveGroupContext();
			await loadGroupMembers();
		});
	});

	document.querySelectorAll('.copy-code-btn').forEach((button) => {
		button.addEventListener('click', async (event) => {
			event.stopPropagation();
			const code = button.dataset.code;
			if (!code) {
				return;
			}

			try {
				await navigator.clipboard.writeText(code);
				button.classList.add('copied');
				setTimeout(() => button.classList.remove('copied'), 1000);
			} catch {
				notify('Failed to copy join code.', true);
			}
		});
	});
}

function updateActiveGroupContext() {
	const activeGroup = getActiveGroup();

	if (!activeGroup) {
		currentGroupRole = null;
		memberManageHint.textContent = 'Only admins can kick members.';
		return;
	}

	currentGroupRole = activeGroup.memberRole || 'MEMBER';
	memberManageHint.textContent =
		currentGroupRole === 'ADMIN'
			? `Active household: ${activeGroup.name}. You are admin. Kicking members is enabled.`
			: `Active household: ${activeGroup.name}. Only admins can kick members.`;
}

async function loadGroupMembers() {
	if (!currentGroupId) {
		memberActionsList.innerHTML = '<div class="empty-state">Join or create a household to manage members.</div>';
		return;
	}

	try {
		const data = await apiRequest(`/groups/${currentGroupId}/members`, 'GET');
		const members = Array.isArray(data.members) ? data.members : [];

		if (!members.length) {
			memberActionsList.innerHTML = '<div class="empty-state">No members found.</div>';
			return;
		}

		let otherMemberCounter = 1;
		memberActionsList.innerHTML = members
			.map((member) => {
				const isSelf = member.userId === currentUser.id;
				const isKickEnabled = currentGroupRole === 'ADMIN' && !isSelf;

				const label = isSelf ? `${currentUserName} (You)` : `Member ${otherMemberCounter++}`;
				const shortId = `${member.userId}`.slice(0, 8);

				return `
					<div class="member-row">
						<div>
							<strong>${label}</strong>
							<p>${member.role} • ${member.status} • ID ${shortId}</p>
						</div>

						<button
							class="secondary-btn kick-member-btn"
							type="button"
							data-user-id="${member.userId}"
							data-label="${label}"
							${isKickEnabled ? '' : 'disabled'}
						>
							${isSelf ? 'You' : 'Kick'}
						</button>
					</div>
				`;
			})
			.join('');

		bindKickButtons();
	} catch (error) {
		memberActionsList.innerHTML = `<div class="empty-state">${error.message || 'Failed to load members.'}</div>`;
	}
}

function bindKickButtons() {
	document.querySelectorAll('.kick-member-btn[data-user-id]').forEach((button) => {
		button.addEventListener('click', async () => {
			const memberUserId = button.getAttribute('data-user-id');
			const label = button.getAttribute('data-label') || 'member';

			if (!memberUserId || currentGroupRole !== 'ADMIN') {
				notify('Only admins can kick members.', true);
				return;
			}

			const confirmed = await requireDoubleConfirmation(
				`Kick ${label}`,
				'This removes the member from the active household.',
				'KICK MEMBER',
				'Kick member'
			);
			if (!confirmed) {
				return;
			}

			try {
				await apiRequest(`/groups/${currentGroupId}/members/${memberUserId}`, 'DELETE');
				notify(`${label} was removed.`);
				setDangerStatus(`${label} was removed from the household.`, false);
				await loadGroups();
				await loadGroupMembers();
			} catch (error) {
				const message = error.message || 'Failed to kick member.';
				notify(message, true);
				setDangerStatus(message, true);
			}
		});
	});
}

function openDashboardForGroup(groupId) {
	localStorage.setItem('groupId', groupId);
	window.location.href = '/Uddhav_Cota_Frontend/app-shell/app-shell.html';
}

function initializeConfirmationModal() {
	confirmActionCancelBtn?.addEventListener('click', () => finishConfirmation(false));

	confirmActionBackBtn?.addEventListener('click', () => {
		setConfirmationStep(1);
	});

	confirmActionContinueBtn?.addEventListener('click', () => {
		setConfirmationStep(2);
	});

	confirmActionSubmitBtn?.addEventListener('click', () => {
		const typed = (confirmActionInput?.value || '').trim().toUpperCase();
		if (!typed || typed !== confirmPhrase) {
			setConfirmError('Confirmation phrase did not match.');
			return;
		}

		finishConfirmation(true);
	});

	confirmActionInput?.addEventListener('input', () => {
		clearConfirmError();
	});

	confirmActionModal?.addEventListener('click', (event) => {
		if (event.target === confirmActionModal) {
			finishConfirmation(false);
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && isModalOpen(confirmActionModal)) {
			finishConfirmation(false);
		}
	});
}

function isModalOpen(modal) {
	return Boolean(modal) && !modal.classList.contains('hidden');
}

function openModal(modal) {
	if (!modal) {
		return;
	}

	modal.classList.remove('hidden');
	modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
	if (!modal) {
		return;
	}

	modal.classList.add('hidden');
	modal.setAttribute('aria-hidden', 'true');
}

function setConfirmationStep(step) {
	const isStepTwo = step === 2;

	confirmStepOne?.classList.toggle('hidden', isStepTwo);
	confirmStepTwo?.classList.toggle('hidden', !isStepTwo);
	confirmActionBackBtn?.classList.toggle('hidden', !isStepTwo);
	confirmActionContinueBtn?.classList.toggle('hidden', isStepTwo);
	confirmActionSubmitBtn?.classList.toggle('hidden', !isStepTwo);

	if (!isStepTwo && confirmActionInput) {
		confirmActionInput.value = '';
	}

	if (isStepTwo) {
		confirmActionInput?.focus();
	}

	clearConfirmError();
}

function setConfirmError(message) {
	if (!confirmActionError) {
		return;
	}

	confirmActionError.textContent = message;
	confirmActionError.classList.add('is-visible');
}

function clearConfirmError() {
	if (!confirmActionError) {
		return;
	}

	confirmActionError.textContent = '';
	confirmActionError.classList.remove('is-visible');
}

function finishConfirmation(confirmed) {
	const resolver = confirmResolver;
	confirmResolver = null;
	confirmPhrase = '';
	closeModal(confirmActionModal);
	setConfirmationStep(1);

	if (resolver) {
		resolver(confirmed);
	}
}

function requireDoubleConfirmation(actionTitle, actionDescription, phrase, submitLabel = 'Confirm') {
	if (!confirmActionModal) {
		notify('Confirmation modal is unavailable.', true);
		return Promise.resolve(false);
	}

	if (confirmResolver) {
		finishConfirmation(false);
	}

	confirmPhrase = String(phrase).trim().toUpperCase();
	confirmActionTitle.textContent = actionTitle;
	confirmActionDescription.textContent = actionDescription;
	confirmActionPrompt.textContent = `Step 2 of 2: Type "${phrase}" to continue.`;
	confirmActionSubmitBtn.textContent = submitLabel;

	setConfirmationStep(1);
	openModal(confirmActionModal);

	return new Promise((resolve) => {
		confirmResolver = resolve;
	});
}

function mapBackendDeleteError(error, fallbackMessage) {
	const message = (error?.message || '').toLowerCase();
	if (
		message.includes('cannot delete') ||
		message.includes('invalid response from server: 404') ||
		message.includes('invalid response from server: 405')
	) {
		return fallbackMessage;
	}

	return error?.message || fallbackMessage;
}

function getActiveGroup() {
	return groups.find((group) => group.id === currentGroupId) || null;
}

function setDangerStatus(message, isError) {
	dangerStatus.textContent = message || '';
	dangerStatus.classList.toggle('error', Boolean(isError));
}

function clearDangerStatus() {
	setDangerStatus('', false);
}

function capitalize(value) {
	return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}

function notify(message, isError = false) {
	if (typeof window.showToast === 'function') {
		window.showToast(message, isError ? 'error' : 'success');
		return;
	}

	window.alert(message);
}
