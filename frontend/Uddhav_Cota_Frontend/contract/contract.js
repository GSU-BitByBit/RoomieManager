const token = localStorage.getItem("accessToken");
const groupId = localStorage.getItem("groupId");

if (!token) {
  window.location.href = "/samia_frontend/auth/login.html";
}

// logout
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/samia_frontend/auth/login.html";
});

initializePage();

async function initializePage() {
  try {
    const userData = await apiRequest("/auth/me", "GET");
    const user = userData.user || userData || {};

    const emailName = user.email ? user.email.split("@")[0] : "User";
    const userName = user.fullName || user.name || emailName;

    document.getElementById("userNameDisplay").textContent = userName;

    await loadContract();
    await loadHistory();
  } catch (err) {
    console.log(err);
  }
}

async function loadContract() {
  try {
    const data = await apiRequest(`/groups/${groupId}/contract`, "GET");

    document.getElementById("contractText").value =
      data.contract?.draftContent || "";

    document.getElementById("versionDisplay").textContent =
      data.contract?.publishedVersion
        ? `Version ${data.contract.publishedVersion}`
        : "Not published yet";

    document.getElementById("publishedContractText").textContent =
      data.latestPublishedContent || "No published contract yet.";
  } catch (err) {
    console.log(err);
  }
}

document.getElementById("saveBtn")?.addEventListener("click", async () => {
  const content = document.getElementById("contractText").value.trim();

  if (!content) {
    alert("Please write something before saving.");
    return;
  }

  try {
    await apiRequest(`/groups/${groupId}/contract`, "PUT", { content });
    alert("Draft saved!");
    await loadContract();
  } catch (err) {
    alert(err.message || "Save failed");
  }
});

document.getElementById("publishBtn")?.addEventListener("click", async () => {
  const content = document.getElementById("contractText").value.trim();

  if (!content) {
    alert("Please write the contract before publishing.");
    return;
  }

  try {
    await apiRequest(`/groups/${groupId}/contract`, "PUT", { content });
    await apiRequest(`/groups/${groupId}/contract/publish`, "POST");

    alert("Published!");
    await loadContract();
    await loadHistory();
  } catch (err) {
    alert(err.message || "Publish failed");
  }
});

async function loadHistory() {
  try {
    const data = await apiRequest(`/groups/${groupId}/contract/versions`, "GET");
    const versions = data.versions || [];

    if (!versions.length) {
      document.getElementById("historyList").innerHTML = `
        <p>No version history yet.</p>
      `;
      return;
    }

    document.getElementById("historyList").innerHTML = versions.map(v => `
      <div class="history-item">
        <div class="history-version">
          Version ${v.version} - ${new Date(v.createdAt).toLocaleDateString()}
        </div>
        <div class="history-content">${v.content || ""}</div>
      </div>
    `).join("");
  } catch (err) {
    console.log(err);
  }
}