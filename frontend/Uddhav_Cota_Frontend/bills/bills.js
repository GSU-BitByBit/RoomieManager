// bills.js

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

const billsList = document.getElementById("billsList");
const addBillBtn = document.getElementById("addBillBtn");
const billDescriptionInput = document.getElementById("billDescription");
const billAmountInput = document.getElementById("billAmount");

// Fetch existing bills
async function loadBills() {
  try {
    const res = await fetch("http://localhost:3000/api/v1/bills", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to load bills");

    const bills = data.bills || [];
    if (bills.length === 0) {
      billsList.innerHTML = "<p>No bills added yet.</p>";
      return;
    }

    billsList.innerHTML = bills.map(bill => `
      <div class="bill-card" data-id="${bill.id}">
        <span>${bill.description} - $${bill.amount}</span>
        <button class="deleteBtn">Delete</button>
      </div>
    `).join('');

    // Attach delete handlers
    document.querySelectorAll(".deleteBtn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest(".bill-card").dataset.id;
        await deleteBill(id);
        loadBills();
      });
    });

  } catch (err) {
    billsList.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

// Add new bill
addBillBtn.addEventListener("click", async () => {
  const description = billDescriptionInput.value.trim();
  const amount = parseFloat(billAmountInput.value.trim());
  if (!description || isNaN(amount)) return;

  try {
    const res = await fetch("http://localhost:3000/api/v1/bills", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ description, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to add bill");

    billDescriptionInput.value = "";
    billAmountInput.value = "";
    loadBills();

  } catch (err) {
    alert(err.message);
  }
});

// Delete bill
async function deleteBill(id) {
  try {
    const res = await fetch(`http://localhost:3000/api/v1/bills/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to delete bill");
  } catch (err) {
    alert(err.message);
  }
}

// Initial load
loadBills();