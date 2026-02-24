document.getElementById("joinBtn").onclick = () => {
  const code = document.getElementById("joinCode").value

  if (!code) {
    alert("Enter join code")
    return
  }

  alert("Joined group (mock)")

  window.location.href = "../app-shell/app-shell.html"
}