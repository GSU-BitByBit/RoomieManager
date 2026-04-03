// frontend/samia_frontend/auth/api.js

const API_BASE = "http://localhost:3000/api/v1";

async function apiRequest(path, method = "GET", body = null) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

  const headers = {
    "Content-Type": "application/json",
    "x-request-id": requestId,
  };

  const token = localStorage.getItem("accessToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  // If backend returns empty body, avoid crash
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid response from server: ${res.status}`);
  }

  if (!data.success) {
    throw new Error(data.error?.message || "Unknown error");
  }

  return data.data;
}