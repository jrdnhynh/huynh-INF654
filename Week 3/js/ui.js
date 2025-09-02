document.addEventListener("DOMContentLoaded", function(){
    // sidenav initialization
    const menus = document.querySelector(".sidenav");
    M.Sidenav.init(menus,{edge: "right"});
    // add task
    const forms = document.querySelector(".side-form");
    M.Sidenav.init(forms,{edge: "left"});
});