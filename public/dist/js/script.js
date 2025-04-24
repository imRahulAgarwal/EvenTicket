$(document).ready(function () {
    function handleSidebar() {
        const screenWidth = $(window).width();
        if (screenWidth >= 768) {
            $("#sidebar").addClass("sidebar-show");
            $("#sidebar").removeClass("sidebar-hidden");
            $("main").removeClass("sidebar-closed");
            $("main").addClass("sidebar-open");
        } else {
            $("#sidebar").addClass("sidebar-hidden");
            $("#sidebar").removeClass("sidebar-show");
            $("main").addClass("sidebar-closed");
            $("main").removeClass("sidebar-open");
        }
    }

    // Initial state
    handleSidebar();

    // Window resize handler
    $(window).resize(handleSidebar);

    // Toggle button click handler
    $("#sidebarToggle").click(function () {
        $("#sidebar").toggleClass("sidebar-hidden sidebar-show");
        $("main").toggleClass("sidebar-open sidebar-closed ");
    });
});
