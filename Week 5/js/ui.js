document.addEventListener("DOMContentLoaded", function () {
  //Side navigation
  const menus = document.querySelector(".sidenav");
  M.Sidenav.init(menus, { edge: "right" });
  //Side Form
  const forms = document.querySelector(".side-form");
  M.Sidenav.init(forms, { edge: "left" });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/serviceWorker.js")
    .then((req) => console.log("Service Worker Registered!", req))
    .catch((err) => console.log("Service Worker registration failed", err));
}
