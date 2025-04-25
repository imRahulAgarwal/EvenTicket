import Client from "../models/client.js";
import PanelUser from "../models/panel-user.js";
import asyncHandler from "./asyncMiddleware.js";

export async function isNotAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect("/panel");
    }
    return next();
}

export const isAuthenticated = asyncHandler(async (req, res, next) => {
    let authUser = req.session?.user;
    if (!authUser) {
        req.flash("error", "Please login to continue");
        return res.redirect("/panel/login");
    }

    let user = await PanelUser.findOne({ _id: authUser.id, isDeleted: false });
    if (!user) {
        res.clearCookie("connect.sid");
        delete req.session["user"];
        return res.redirect("/panel/login");
    }

    await user.populate({ path: "roles", populate: { path: "permissions" } });

    const userPermissions = user.roles.flatMap((role) => role.permissions.map((permission) => permission.uniqueName));

    req.user = user;
    req.userPermissions = userPermissions;
    const isAdmin = user.roles.some((role) => role.isAdmin);
    req.isAdmin = isAdmin;

    return next();
});

export const checkPermission = (requiredPermission) => (req, res, next) => {
    let userPermissions = req.userPermissions;
    let isAdmin = req.isAdmin;

    // If no specific permission is required or is admin, allow access
    if (!requiredPermission || isAdmin) {
        return next();
    }

    // Check if the user has the required permission
    const hasPermission = userPermissions.some((permission) =>
        requiredPermission.split(",").some((reqPermission) => reqPermission === permission)
    );

    if (!hasPermission) {
        req.flash("error", "Cannot access the resource");
        return res.redirect("/panel");
    }

    return next();
};

export async function isClientNotAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect("/client");
    }
    return next();
}

export const isClientAuthenticated = asyncHandler(async (req, res, next) => {
    let authUser = req.session?.user;
    if (!authUser) {
        req.flash("error", "Please login to continue");
        return res.redirect("/client/login");
    }

    let user = await Client.findOne({ _id: authUser.id, isDeleted: false });
    if (!user) {
        res.clearCookie("connect.sid");
        delete req.session["user"];
        return res.redirect("/client/login");
    }

    req.user = user;

    return next();
});
