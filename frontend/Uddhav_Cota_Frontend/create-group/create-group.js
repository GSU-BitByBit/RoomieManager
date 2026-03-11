document.getElementById("createBtn").onclick = async () => {
  const token = localStorage.getItem("accessToken")
  const name = document.getElementById("groupName").value

  if (!name) {
    alert("Enter group name")
    return
  }

  const res = await fetch("http://localhost:3000/api/v1/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ name })
  })

  const body = await res.json()

  if (!body.success) {
    alert(body.error.message)
    return
  }

  // Save group ID
  localStorage.setItem("currentGroupId", body.data.id)

  window.location.href = "../app-shell/app-shell.html"
}