import sidebarLinks from "../data/sidebarLinks.js";

function pagesToShow(req) {
    const isAdmin = req.user.roles.some((role) => role.isAdmin);
    if (isAdmin) {
        return sidebarLinks.map(({ name, href, icon, id }) => ({ name, href, icon, id: id || "" }));
    }

    const userPermissions = req.userPermissions;
    const permissionSet = new Set(userPermissions.map((p) => p.toLowerCase()));

    const visibleLinks = sidebarLinks.filter((link) => {
        if (link.isAdmin) {
            return false;
        }

        const uniqueNames = Array.isArray(link.uniqueName) ? link.uniqueName : [link.uniqueName];
        return uniqueNames.some((name) => {
            if (name === true) {
                return true;
            } else if (permissionSet.has(name?.toLowerCase())) {
                return true;
            }

            return false;
        });
    });

    return visibleLinks.map(({ name, href, icon, id }) => ({ name, href, icon, id: id || "" }));
}

export default pagesToShow;
