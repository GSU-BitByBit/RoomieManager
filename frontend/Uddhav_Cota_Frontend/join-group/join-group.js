document.getElementById("joinBtn").onclick = () => {
  const code = document.getElementById("joinCode").value

  if (!code) {
    alert("Enter join code")
    return
  }

  document.getElementById("joinBtn").onclick = async () => {
    const token = localStorage.getItem("accessToken")
    const code = document.getElementById("joinCode").value

    if (!code) {
      alert("Enter join code")
      return
    }

    const res = await fetch("http://localhost:3000/api/v1/groups/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ joinCode: code })
    })

    const body = await res.json()

    if (!body.success) {
      alert(body.error.message)
      return
    }

    localStorage.setItem("currentGroupId", body.data.id)

    window.location.href = "../app-shell/app-shell.html"
  }
}