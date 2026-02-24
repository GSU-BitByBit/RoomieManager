document.getElementById("createBtn").onclick = () => {
  const name = document.getElementById("groupName").value

  if (!name) {
    alert("Enter group name")
    return
  }

  alert("Group created (mock)")

  window.location.href = "../app-shell/app-shell.html"
}