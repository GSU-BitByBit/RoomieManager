// api.js
const API_BASE = "http://localhost:3000/api/v1";

async function apiRequest(path, method = "GET", body = null) {
  const requestId = crypto.randomUUID();

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

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data.data;
}