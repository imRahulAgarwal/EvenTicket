import dayjs from "dayjs";
import asyncHandler from "../middlewares/asyncMiddleware.js";
import Client from "../models/client.js";
import ClientEvent from "../models/event.js";
import PanelUser from "../models/panel-user.js";
import Permission from "../models/permission.js";
import UserRole from "../models/role.js";
import TicketGenerationBatch from "../models/ticket-generation-batch.js";
import TicketType from "../models/ticket-type.js";
import Ticket from "../models/ticket.js";
import emailSchema from "../schemas/email.js";
import loginSchema from "../schemas/login.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { imageUpload } from "../utils/uploader.js";
import validateObjectId from "../schemas/objectId.js";
import { changePasswordSchema, resetPasswordSchema } from "../schemas/password.js";
import pagesToShow from "../utils/pagesToShow.js";
import clientSchema from "../schemas/client.js";
import permissions from "../data/permissions.js";
import roleSchema from "../schemas/role.js";
import panelUserSchema from "../schemas/panelUser.js";
import eventSchema from "../schemas/event.js";
import fs from "fs";
import { Types } from "mongoose";
import ticketTypeSchema from "../schemas/ticket-type.js";
import generateQr from "../utils/generateTicket.js";
import archiver from "archiver";
import Category from "../models/category.js";
import categorySchema from "../schemas/category.js";
import {
    fetchKpiMetrics,
    fetchPastEventData,
    fetchUpcomingEventData,
    getEventsCountByCategory,
    getEventsCountByTop10Clients,
    getPanelUsersCountFromUserRole,
} from "../utils/dashboardService.js";

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;
const PAGE_LIMIT = 10;
const TIME_ZONE = "Asia/Kolkata";
const TIME_FORMAT = "";

export const loginPage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Login" },
        error: req.flash("error"),
        success: req.flash("success"),
    };

    return res.render("panel/login", data);
});

export const login = asyncHandler(async (req, res, next) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/login");
    }

    const { email, password } = validation.data;

    const userExists = await PanelUser.findOne({ email, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/login");
    }

    const isSamePassword = comparePassword(password, userExists.password);
    if (!isSamePassword) {
        req.flash("error", "Invalid password");
        return res.redirect("/panel/login");
    }

    req.session.user = { id: userExists._id, name: userExists.name, email: userExists.email };
    req.flash("success", "Panel user login successful");
    return res.redirect("/panel");
});

export const forgotPasswordPage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Forgot Password" },
        error: req.flash("error"),
        success: req.flash("success"),
    };

    return res.render("panel/forgot-password", data);
});

export const forgotPassword = asyncHandler(async (req, res, next) => {
    const validation = emailSchema.safeParse(req.body.email);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/login");
    }

    const email = validation.data;

    const userExists = await PanelUser.findOne({ email, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/forgot-password");
    }

    const otp = Math.round(100000 + Math.random() * 900000);
    const otpExpiryTime = dayjs().add(2, "minutes");

    // Add mail process which will be async (background task)

    userExists.set("otp", otp);
    userExists.set("otpExpiryTime", otpExpiryTime);
    await userExists.save();

    req.flash("success", "E-Mail sent successfully");
    return res.redirect(`/panel/otp/verification/${userExists.id}`);
});

export const verifyOtpPage = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid User ID");
        return res.redirect("/panel/forgot-password");
    }

    const userExists = await PanelUser.findOne({ _id: userId, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/forgot-password");
    }

    if (!userExists.otp || !userExists.otpExpiryTime) {
        req.flash("error", "Forgot password request not found!");
        return res.redirect("/panel/forgot-password");
    }

    if (dayjs(userExists.otpExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/panel/forgot-password");
    }

    if (dayjs(userExists.expiryTimeToResetPassword).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/panel/forgot-password");
    }

    const data = {
        page: { title: "EvenTicket OTP Verification" },
        error: req.flash("error"),
        success: req.flash("success"),
        userId,
    };

    return res.render("panel/otp-verification", data);
});

export const verifyOtp = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;
    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid Panel User ID");
        return res.redirect("/panel/forgot-password");
    }

    let { otp } = req.body;
    otp = parseInt(otp, 10);

    const userExists = await PanelUser.findOne({ _id: userId, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/forgot-password");
    }

    if (userExists.otp !== otp) {
        req.flash("error", "Invalid OTP");
        return res.redirect(`/panel/otp-verification/${userId}`);
    }

    if (dayjs(userExists.otpExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP Expired");
        return res.redirect("/panel/forgot-password");
    }

    userExists.set("expiryTimeToResetPassword", dayjs().add(2, "minutes"));
    await userExists.save();

    req.flash("success", "OTP Verified");
    return res.redirect(`/panel/reset-password/${userExists.id}`);
});

export const resetPasswordPage = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid User ID");
        return res.redirect("/panel/forgot-password");
    }

    const userExists = await PanelUser.findOne({ _id: userId, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/forgot-password");
    }

    if (!userExists.otp || !userExists.otpExpiryTime) {
        req.flash("error", "Forgot password request not found!");
        return res.redirect("/panel/forgot-password");
    }

    if (dayjs(userExists.otpExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/panel/forgot-password");
    }

    if (dayjs(userExists.expiryTimeToResetPassword).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/panel/forgot-password");
    }

    const data = {
        page: { title: "" },
        error: req.flash("error"),
        success: req.flash("success"),
        userId,
    };

    return res.render("panel/reset-password", data);
});

export const resetPassword = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;
    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid Panel User ID");
        return res.redirect("/panel/forgot-password");
    }

    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect(`/panel/reset-password/${userId}`);
    }

    const searchQuery = {
        _id: userId,
        isDeleted: false,
        otp: { $ne: null },
        otpExpiryTime: { $ne: null },
    };

    const userExists = await PanelUser.findOne(searchQuery);

    if (!userExists) {
        req.flash("error", "Panel User details not found");
        return res.redirect("/panel/forgot-password");
    }

    if (dayjs(userExists.resetPasswordExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "Time to reset password has expired, try again");
        return res.redirect("/panel/forgot-password");
    }

    const { newPassword } = validation.data;
    const hashedPassword = hashPassword(newPassword);

    const updateQuery = {
        $set: { password: hashedPassword },
        $unset: { otp: 1, otpExpiryTime: 1, resetPasswordExpiryTime: 1 },
    };

    const updateResult = await PanelUser.updateOne(searchQuery, updateQuery);

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/forgot-password");
    }

    req.flash("success", "Password resetted successfully.");
    return res.redirect("/panel/login");
});

export const dashboardPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const [kpiData, upcomingEventsData, pastEventsData, eventDataByCategory, eventDataByClient, panelUsersCountByRole] =
        await Promise.all([
            fetchKpiMetrics(),
            fetchUpcomingEventData(),
            fetchPastEventData(),
            getEventsCountByCategory(),
            getEventsCountByTop10Clients(),
            getPanelUsersCountFromUserRole(),
        ]);

    const data = {
        page: { title: "EvenTicket Dashboard" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        kpiData,
        upcomingEventsData,
        pastEventsData,
        eventDataByCategory,
        eventDataByClient,
        panelUsersCountByRole,
    };

    return res.render("panel/pages/dashboard", data);
});

export const profilePage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Profile" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
    };

    return res.render("panel/pages/profile", data);
});

export const changePassword = asyncHandler(async (req, res, next) => {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel");
    }

    const user = req.user;
    const { oldPassword, newPassword } = validation.data;

    const isSamePassword = comparePassword(oldPassword, user.password);
    if (!isSamePassword) {
        req.flash("error", "Invalid Password");
        return res.redirect("/panel");
    }

    const hashedPassword = hashPassword(newPassword);

    const updateResult = await PanelUser.updateOne(
        { _id: user._id, isDeleted: false },
        { $set: { password: hashedPassword } }
    );

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel");
    }

    req.flash("success", "Password changed successfully");
    return res.redirect("/panel");
});

export const clientsPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Clients" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        showReadUi: false,
        showCreateUi: false,
        showUpdateUi: false,
        showDeleteUi: false,
    };

    if (req.isAdmin) {
        data.showReadUi = true;
        data.showCreateUi = true;
        data.showUpdateUi = true;
        data.showDeleteUi = true;
    } else {
        const showReadUi = req.userPermissions.find((permission) => permission === "read_client");
        const showCreateUi = req.userPermissions.find((permission) => permission === "create_client");
        const showUpdateUi = req.userPermissions.find((permission) => permission === "update_client");
        const showDeleteUi = req.userPermissions.find((permission) => permission === "delete_client");

        data.showReadUi = showReadUi;
        data.showCreateUi = showCreateUi;
        data.showUpdateUi = showUpdateUi;
        data.showDeleteUi = showDeleteUi;
    }

    return res.render("panel/pages/clients", data);
});

export const clientPage = asyncHandler(async (req, res, next) => {
    const { clientId } = req.params;
    if (!validateObjectId(clientId)) {
        req.flash("error", "Invalid Client ID");
        return res.redirect("/panel/clients");
    }

    const clientExists = await Client.findOne({ _id: clientId, isDeleted: false }).lean();
    if (!clientExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/panel/clients");
    }

    const { name, email, number } = clientExists;

    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Client" },
        error: req.flash("error"),
        success: req.flash("success"),
        client: { name, email, number },
        pages,
    };

    return res.render("panel/pages/client", data);
});

export const readClients = asyncHandler(async (req, res, next) => {
    let { draw, start, length, search, order, columns } = req.query;

    draw = parseInt(draw, 10);
    start = parseInt(start, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;

    if (length === -1) {
        length = 0;
    }

    search = search && search.value ? String(search.value.trim()) : "";

    const matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const sortQuery = {};
    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column);
        const orderToSort = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name", "createdAt"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderToSort;
        } else {
            sortQuery["createdAt"] = orderToSort;
        }
    } else {
        sortQuery["createdAt"] = 1;
    }

    const clientData = await Client.aggregate([
        { $match: { isDeleted: false } },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: matchQuery }, { $count: "count" }],
                data: [
                    { $match: matchQuery },
                    { $sort: sortQuery },
                    { $skip: start },
                    { $limit: length },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            number: 1,
                            createdAt: 1,
                        },
                    },
                ],
            },
        },
    ]);

    const data = {
        draw,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    if (clientData.length) {
        data.recordsTotal = clientData[0].recordsTotal[0]?.count || 0;
        data.recordsFiltered = clientData[0].recordsFiltered[0]?.count || 0;
        data.data = clientData[0].data;
    }

    return res.status(200).json({ success: true, data });
});

export const readClient = asyncHandler(async (req, res, next) => {
    const { clientId } = req.params;
    if (!validateObjectId(clientId)) {
        return res.status(400).json({ success: false, error: "Invalid client ID" });
    }

    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        return res.status(404).json({ success: false, error: "Client details not found" });
    }

    return res.status(200).json({ success: true, data: { client } });
});

export const createClient = asyncHandler(async (req, res, next) => {
    const validation = clientSchema.safeParse(req.body);

    if (validation.error) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/clients");
    }

    const password = hashPassword(DEFAULT_PASSWORD);
    const newClient = await Client.create({ ...validation.data, password });

    if (!newClient) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/clients");
    }

    req.flash("success", "Client details added");
    return res.redirect("/panel/clients");
});

export const updateClient = asyncHandler(async (req, res, next) => {
    const { clientId } = req.params;

    if (!validateObjectId(clientId)) {
        req.flash("error", "Invalid Client ID");
        return res.redirect("/panel/clients");
    }

    const validation = clientSchema.safeParse(req.body);
    if (validation.error) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/clients");
    }

    const searchQuery = { _id: clientId, isDeleted: false };

    const clientExists = await Client.findOne(searchQuery);
    if (!clientExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/panel/clients");
    }

    const updateResult = await Client.updateOne(searchQuery, { $set: { ...validation.data } });
    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/clients");
    }

    req.flash("success", "Client details updated");
    return res.redirect("/panel/clients");
});

export const deleteClient = asyncHandler(async (req, res, next) => {
    const { clientId } = req.params;
    if (!validateObjectId(clientId)) {
        req.flash("error", "Invalid Client ID");
        return res.redirect("/panel/clients");
    }

    const searchQuery = { _id: clientId, isDeleted: false };

    const clientExists = await Client.findOne(searchQuery);
    if (!clientExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/panel/clients");
    }

    const updateResult = await Client.updateOne(searchQuery, { $set: { isDeleted: true } });
    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/clients");
    }

    req.flash("success", "Client details removed");
    return res.redirect("/panel/clients");
});

export const categoryPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Categories" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        showReadUi: false,
        showCreateUi: false,
        showUpdateUi: false,
        showDeleteUi: false,
    };

    if (req.isAdmin) {
        data.showReadUi = true;
        data.showCreateUi = true;
        data.showUpdateUi = true;
        data.showDeleteUi = true;
    } else {
        const showReadUi = req.userPermissions.find((permission) => permission === "read_category");
        const showCreateUi = req.userPermissions.find((permission) => permission === "create_category");
        const showUpdateUi = req.userPermissions.find((permission) => permission === "update_category");
        const showDeleteUi = req.userPermissions.find((permission) => permission === "delete_category");

        data.showReadUi = showReadUi;
        data.showCreateUi = showCreateUi;
        data.showUpdateUi = showUpdateUi;
        data.showDeleteUi = showDeleteUi;
    }

    return res.render("panel/pages/category", data);
});

export const readCategories = asyncHandler(async (req, res, next) => {
    let { draw, start, length, search, order, columns } = req.query;

    draw = parseInt(draw, 10);
    start = parseInt(start, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;
    if (length === -1) {
        length = 0;
    }

    search = search && search.value ? String(search.value.trim()) : "";

    const matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const sortQuery = {};
    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column);
        const orderToSort = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderToSort;
        } else {
            sortQuery["name"] = orderToSort;
        }
    } else {
        sortQuery["name"] = 1;
    }

    const categoryData = await Category.aggregate([
        { $match: { isDeleted: false } },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: matchQuery }, { $count: "count" }],
                data: [
                    { $match: matchQuery },
                    { $sort: sortQuery },
                    { $skip: start },
                    { $limit: length },
                    { $project: { _id: 1, name: 1 } },
                ],
            },
        },
    ]);

    const data = {
        draw,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    if (categoryData.length) {
        data.recordsTotal = categoryData[0].recordsTotal[0]?.count || 0;
        data.recordsFiltered = categoryData[0].recordsFiltered[0]?.count || 0;
        data.data = categoryData[0].data;
    }

    return res.status(200).json({ success: true, data });
});

export const readCategory = asyncHandler(async (req, res, next) => {
    const { categoryId } = req.params;
    if (!validateObjectId(categoryId)) {
        return res.status(400).json({ success: false, error: "Invalid category ID" });
    }

    const category = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!category) {
        return res.status(404).json({ success: false, error: "Category details not found" });
    }

    return res.status(200).json({ success: true, data: { category } });
});

export const createCategory = asyncHandler(async (req, res, next) => {
    const validation = categorySchema.safeParse(req.body);
    if (validation.error) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/category");
    }

    const { name } = validation.data;

    const categoryExists = await Category.findOne({ name, isDeleted: false });
    if (categoryExists) {
        req.flash("error", "Category details already exists.");
        return res.redirect("/panel/category");
    }

    await Category.create({ name });

    req.flash("success", "Category details created.");
    return res.redirect("/panel/category");
});

export const updateCategory = asyncHandler(async (req, res, next) => {
    const { categoryId } = req.params;
    if (!validateObjectId(categoryId)) {
        req.flash("error", "Invalid category ID.");
        return res.redirect("/panel/category");
    }

    const validation = categorySchema.safeParse(req.body);
    if (validation.error) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/category");
    }

    const { name } = validation.data;

    const categoryExists = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!categoryExists) {
        req.flash("error", "Category details not found.");
        return res.redirect("/panel/category");
    }

    const categoryWithSameNameExists = await Category.findOne({ _id: { $ne: categoryId }, name, isDeleted: false });
    if (categoryWithSameNameExists) {
        req.flash("error", "Category details already exists.");
        return res.redirect("/panel/category");
    }

    categoryExists.set("name", name);
    await categoryExists.save();

    req.flash("success", "Category details updated.");
    return res.redirect("/panel/category");
});

export const deleteCategory = asyncHandler(async (req, res, next) => {
    const { categoryId } = req.params;
    if (!validateObjectId(categoryId)) {
        req.flash("error", "Invalid Category ID");
        return res.redirect("/panel/category");
    }

    const searchQuery = { _id: categoryId, isDeleted: false };

    const category = await Category.findOne(searchQuery);
    if (!category) {
        req.flash("error", "Category details not found");
        return res.redirect("/panel/category");
    }

    const updateResult = await Category.updateOne(searchQuery, { $set: { isDeleted: true } });
    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/category");
    }

    req.flash("success", "Category details removed");
    return res.redirect("/panel/category");
});

export const eventsPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Events" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        showReadUi: false,
        showCreateUi: false,
        showUpdateUi: false,
        showDeleteUi: false,
    };

    if (req.isAdmin) {
        data.showReadUi = true;
        data.showCreateUi = true;
        data.showUpdateUi = true;
        data.showDeleteUi = true;
    } else {
        const showReadUi = req.userPermissions.find((permission) => permission === "read_event");
        const showCreateUi = req.userPermissions.find((permission) => permission === "create_event");
        const showUpdateUi = req.userPermissions.find((permission) => permission === "update_event");
        const showDeleteUi = req.userPermissions.find((permission) => permission === "delete_event");

        data.showReadUi = showReadUi;
        data.showCreateUi = showCreateUi;
        data.showUpdateUi = showUpdateUi;
        data.showDeleteUi = showDeleteUi;
    }

    return res.render("panel/pages/events", data);
});

export const eventPage = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Client Event ID");
        return res.redirect("/panel/events");
    }

    let event = await ClientEvent.aggregate([
        { $match: { _id: new Types.ObjectId(eventId), isDeleted: false } },
        {
            $lookup: {
                from: "clients",
                localField: "clientId",
                foreignField: "_id",
                as: "client",
            },
        },
        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "category",
                localField: "categoryId",
                foreignField: "_id",
                as: "category",
            },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "ticket_types",
                foreignField: "eventId",
                localField: "_id",
                as: "ticketTypes",
                pipeline: [
                    { $match: { isDeleted: false } },
                    { $addFields: { designPath: { $concat: ["/", "$designPath"] } } },
                    {
                        $lookup: {
                            from: "tickets",
                            let: { eventId: "$eventId", ticketTypeId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$eventId", "$$eventId"] },
                                                { $eq: ["$ticketTypeId", "$$ticketTypeId"] },
                                            ],
                                        },
                                    },
                                },
                                { $count: "total" },
                            ],
                            as: "ticketCount",
                        },
                    },
                    { $unwind: { path: "$ticketCount", preserveNullAndEmptyArrays: true } },
                    {
                        $addFields: {
                            ticketCount: "$ticketCount.total",
                        },
                    },
                    {
                        $project: {
                            isDeleted: 0,
                            eventId: 0,
                            createdAt: 0,
                            updatedAt: 0,
                        },
                    },
                ],
            },
        },
        {
            $project: {
                _id: 1,
                eventName: "$name",
                eventDate: "$dateTime",
                ticketTypes: 1,
                clientName: "$client.name",
                clientEmail: "$client.email",
                clientNumber: "$client.number",
                categoryName: "$category.name",
            },
        },
    ]);

    if (!event.length) {
        req.flash("error", "Client event details not found");
        return res.redirect("/panel/events");
    }

    event = event[0];

    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Client Event" },
        error: req.flash("error"),
        success: req.flash("success"),
        event,
        pages,
        showGenerateTicketUi: false,
    };

    if (req.isAdmin) {
        data.showGenerateTicketUi = true;
    } else {
        let showGenerateTicketUi = req.userPermissions.find((permission) => permission === "generate_ticket");
        data.showGenerateTicketUi = showGenerateTicketUi;
    }

    return res.render("panel/pages/event", data);
});

export const readEvents = asyncHandler(async (req, res, next) => {
    let { draw, start, length, search, order, columns } = req.query;

    draw = parseInt(draw, 10);
    start = parseInt(start, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;

    if (length === -1) {
        length = 0;
    }

    search = search && search.value ? String(search.value.trim()) : "";

    const matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const sortQuery = {};
    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column);
        const orderToSort = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name", "dateTime", "createdAt"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderToSort;
        } else {
            sortQuery["createdAt"] = orderToSort;
        }
    } else {
        sortQuery["createdAt"] = 1;
    }

    const clientEventData = await ClientEvent.aggregate([
        { $match: { isDeleted: false } },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: matchQuery }, { $count: "count" }],
                data: [
                    { $match: matchQuery },
                    {
                        $lookup: {
                            from: "clients",
                            foreignField: "_id",
                            localField: "clientId",
                            as: "client",
                        },
                    },
                    { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
                    { $sort: sortQuery },
                    { $skip: start },
                    { $limit: length },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            dateTime: 1,
                            createdAt: 1,
                            clientId: "$client._id",
                            clientName: "$client.name",
                        },
                    },
                ],
            },
        },
    ]);

    const data = {
        draw,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    if (clientEventData.length) {
        data.recordsTotal = clientEventData[0].recordsTotal[0]?.count || 0;
        data.recordsFiltered = clientEventData[0].recordsFiltered[0]?.count || 0;
        data.data = clientEventData[0].data;
    }

    return res.status(200).json({ success: true, data });
});

export const readEvent = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        return res.status(400).json({ success: false, error: "Invalid Event ID" });
    }

    const eventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!eventExists) {
        return res.status(404).json({ success: false, error: "Event details not found" });
    }

    return res.stauts(200).json({ success: true, event: eventExists });
});

export const createEventPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Add Event" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
    };

    return res.render("panel/pages/add-event", data);
});

export const createEvent = asyncHandler(async (req, res, next) => {
    try {
        await new Promise((resolve, reject) => {
            imageUpload.array("ticketFiles")(req, res, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }

    let {
        name,
        date,
        clientId,
        categoryId,
        ticketTypes,
        allowVerificationByClient,
        allowAllTicketVerifiers,
        allowedTicketVerifiers,
    } = req.body;

    if (!validateObjectId(clientId)) {
        return res.status(400).json({ success: false, error: "Invalid Client ID" });
    }

    if (!validateObjectId(categoryId)) {
        return res.status(400).json({ success: false, error: "Invalid Category ID" });
    }

    const validation = eventSchema.safeParse({ name, date, allowVerificationByClient, allowAllTicketVerifiers });
    if (!validation.success) {
        const error = validation.error.errors.map((error) => error.message);
        return res.status(400).json({ success: false, error: error[0] });
    }

    name = validation.data.name;
    date = validation.data.date;
    allowVerificationByClient = validation.data.allowVerificationByClient;
    allowAllTicketVerifiers = validation.data.allowAllTicketVerifiers;

    const clientExists = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!clientExists) {
        return res.status(404).json({ success: false, error: "Client details not found" });
    }

    const categoryExists = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!categoryExists) {
        return res.status(404).json({ success: false, error: "Category details not found" });
    }

    const ticketVerifierUsers = [];

    if (!allowAllTicketVerifiers) {
        const verifierIds = allowedTicketVerifiers.split(",");
        for (const verifierId of verifierIds) {
            const verifierUser = await PanelUser.findOne({ _id: verifierId, isDeleted: false });
            if (verifierUser) {
                ticketVerifierUsers.push(verifierId);
            }
        }
    }

    const newEvent = await ClientEvent.create({
        name,
        dateTime: date,
        clientId,
        categoryId,
        allowVerificationByClient,
        allowAllTicketVerifiers,
        allowedTicketVerifiers: ticketVerifierUsers,
    });

    if (!newEvent) {
        return res.status(500).json({ success: false, error: "Internal server error" });
    }

    ticketTypes = JSON.parse(ticketTypes);

    const eventFolder = `uploads/events/${newEvent._id}`;
    const ticketTypeFolder = `${eventFolder}/TicketTypes`;

    if (!fs.existsSync(ticketTypeFolder)) {
        fs.mkdirSync(ticketTypeFolder, { recursive: true });
    }

    for (const ticketType of ticketTypes) {
        const newTicketType = new TicketType({
            name: ticketType.name,
            qrPositions: { top: ticketType.qrData.y, left: ticketType.qrData.x },
            qrDimensions: { width: ticketType.qrData.width, height: ticketType.qrData.height },
            eventId: newEvent._id,
        });

        const ticketTypeFile = req.files.find((file) => file.originalname === ticketType.fileName);
        const filePath = `${ticketTypeFolder}/${Date.now()}_${ticketTypeFile.originalname}`;
        fs.writeFileSync(filePath, ticketTypeFile.buffer);

        newTicketType.set("designPath", filePath);
        await newTicketType.save();
    }

    return res.status(200).json({ success: true, message: "Event created successfully" });
});

export const updateEventPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Client ID");
        return res.redirect("/panel/events");
    }

    const event = await ClientEvent.findOne({ _id: eventId, isDeleted: false }).populate("categoryId").lean();
    if (!event) {
        req.flash("error", "Event details not found");
        return res.redirect("/panel/events");
    }

    event.dateTime = dayjs(event.dateTime).format("YYYY-MM-DDTHH:mm");

    // const ticketTypes = await TicketType.find({ eventId, isDeleted: false });
    // ticketTypes.forEach((ticketType) => (ticketType.designPath =  "/" + ticketType.designPath));
    // event.ticketTypes = ticketTypes;

    const data = {
        page: { title: "EvenTicket Update Event" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        event,
    };

    return res.render("panel/pages/update-event", data);
});

export const updateEvent = asyncHandler(async (req, res, next) => {
    try {
        await new Promise((resolve, reject) => {
            imageUpload.array("ticketFiles")(req, res, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }

    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        return res.status(400).json({ success: false, error: "Invalid Event ID" });
    }

    const eventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!eventExists) {
        return res.status(404).json({ success: false, error: "Event details not found" });
    }

    let { name, date, allowVerificationByClient, allowAllTicketVerifiers, allowedTicketVerifiers, categoryId } =
        req.body;

    if (!validateObjectId(categoryId)) {
        return res.status(400).json({ success: false, error: "Invalid Category ID" });
    }

    const validation = eventSchema.safeParse({
        name,
        date,
        allowVerificationByClient,
        allowAllTicketVerifiers,
    });

    if (!validation.success) {
        const error = validation.error.errors.map((error) => error.message);
        return res.status(400).json({ success: false, error: error[0] });
    }

    name = validation.data.name;
    date = validation.data.date;
    allowVerificationByClient = validation.data.allowVerificationByClient;
    allowAllTicketVerifiers = validation.data.allowAllTicketVerifiers;

    const categoryExists = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!categoryExists) {
        return res.status(404).json({ success: false, error: "Category details not found" });
    }

    const ticketVerifierUsers = [];

    if (!allowAllTicketVerifiers && allowedTicketVerifiers) {
        const verifierIds = allowedTicketVerifiers.split(",");
        for (const verifierId of verifierIds) {
            if (verifierId) {
                const verifierUser = await PanelUser.findOne({ _id: verifierId, isDeleted: false });
                if (verifierUser) {
                    ticketVerifierUsers.push(verifierId);
                }
            }
        }
    }

    const updateResult = await ClientEvent.updateOne(
        { _id: eventId, isDeleted: false },
        {
            $set: {
                name,
                dateTime: date,
                allowVerificationByClient,
                allowAllTicketVerifiers,
                allowedTicketVerifiers: ticketVerifierUsers,
            },
        }
    );

    if (!updateResult.modifiedCount) {
        return res.stauts(500).json({ success: false, error: "Internal server error" });
    }

    return res.status(200).json({ success: true, message: "Event details updated" });
});

export const deleteEvent = asyncHandler(async (req, res, next) => {
    let { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Event ID");
        return res.redirect("/panel/events");
    }

    let clientEventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!clientEventExists) {
        req.flash("error", "Event details not found");
        return res.redirect("/panel/events");
    }

    let updateResult = await ClientEvent.updateOne({ _id: eventId, isDeleted: false }, { $set: { isDeleted: true } });
    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/events");
    }

    req.flash("success", "Event details removed");
    return res.redirect("/panel/events");
});

export const readGeneratedTickets = asyncHandler(async (req, res, next) => {
    let data = {
        draw: 0,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    let { draw, columns, order, start, length, search } = req.query;

    draw = parseInt(draw, 10);
    length = parseInt(length, 10) || PAGE_LIMIT;
    search = search && search.value ? String(search.value.trim()) : "";
    start = parseInt(start, 10) || 0;

    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        return res.status(400).json({ success: false, error: "Invalid Event ID" });
    }

    const eventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!eventExists) {
        return res.status(404).json({ success: false, error: "Event details not found" });
    }

    let sortQuery = {};
    if (order && order.length) {
        const columnIndexToSort = order[0].column;
        const sortOrder = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToSort].name || columns[columnIndexToSort].data;

        const sortableFields = ["createdAt"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = sortOrder;
        } else {
            sortQuery["createdAt"] = 1;
        }
    } else {
        sortQuery = { createdAt: 1 };
    }

    let generatedTickets = await TicketGenerationBatch.aggregate([
        { $match: { eventId: new Types.ObjectId(eventId) } },
        { $sort: sortQuery },
        { $skip: start },
        { $limit: length },
        {
            $project: {
                createdAt: "$createdAt",
                ticketGenerationId: "$_id",
            },
        },
    ]);

    let totalRecords = await TicketGenerationBatch.countDocuments({});

    data.draw = draw;
    data.recordsTotal = totalRecords;
    data.recordsFiltered = totalRecords;
    data.data = generatedTickets;

    return res.status(200).json({ success: true, data });
});

export const ticketGeneratedBatchPage = asyncHandler(async (req, res, next) => {
    let { batchId } = req.params;
    if (!validateObjectId(batchId)) {
        req.flash("error", "Invalid Ticket Generated Batch ID");
        return res.redirect(req.headers.referer);
    }

    let details = await TicketGenerationBatch.aggregate([
        { $match: { _id: new Types.ObjectId(batchId) } },
        {
            $lookup: {
                from: "events",
                localField: "eventId",
                foreignField: "_id",
                as: "event",
            },
        },
        { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
        { $unwind: "$ticketTypes" },
        {
            $lookup: {
                from: "ticket_types",
                let: { eventId: "$eventId", ticketTypeId: "$ticketTypes.ticketTypeId", generationId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$ticketTypeId"] },
                                    { $eq: ["$eventId", "$$eventId"] },
                                    { $eq: ["$isDeleted", false] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            ticketTypeId: "$_id",
                            ticketTypeName: "$name",
                        },
                    },
                ],
                as: "ticketTypes.ticketType",
            },
        },
        { $unwind: { path: "$ticketTypes.ticketType", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                eventId: "$event._id",
                eventName: "$event.name",
                eventDateTime: "$event.dateTime",
                ticketGenerationBatchId: "$_id",
                ticketGenerationBatchTicketTypes: {
                    ticketTypeId: "$ticketTypes.ticketType.ticketTypeId",
                    ticketTypeName: "$ticketTypes.ticketType.ticketTypeName",
                    ticketTypeCount: "$ticketTypes.ticketCount",
                    ticketTypeDownloadLink: {
                        $concat: [
                            "/panel/download/tickets/",
                            { $toString: "$_id" },
                            "?ticketTypeId=",
                            { $toString: "$ticketTypes.ticketType.ticketTypeId" },
                        ],
                    },
                },
                createdAt: 1,
            },
        },
        {
            $group: {
                _id: "$eventId",
                eventId: { $first: "$eventId" },
                eventName: { $first: "$eventName" },
                eventDateTime: { $first: "$eventDateTime" },
                ticketGenerationBatchId: { $first: "$ticketGenerationBatchId" },
                ticketGenerationBatchTicketTypes: { $push: "$ticketGenerationBatchTicketTypes" },
                createdAt: { $first: "$createdAt" },
            },
        },
        {
            $project: {
                _id: 0,
            },
        },
    ]);

    if (!details.length) {
        req.flash("error", "Tickets Generated Batch details not found");
        return res.redirect(req.headers.referer);
    }

    details = details[0];

    // details.eventDate = dayjs(details.eventDate).format(dateTimeFormat);
    // details.createdAt = dayjs(details.createdAt).format(dateTimeFormat);

    let data = {
        page: { title: "Generated Tickets Batch" },
        error: req.flash("error"),
        success: req.flash("success"),
        pages: [],
        event: details,
    };

    let pages = pagesToShow(req);
    req.userPermissions;

    data.pages = pages;
    return res.render("panel/pages/generated-ticket", data);
});

export const renderBatchTicketTypePage = asyncHandler(async (req, res, next) => {
    let { batchId } = req.params;
    let { ticketTypeId } = req.query;

    if (!validateObjectId(batchId)) {
        req.flash("error", "Invalid Ticket Generated Batch ID");
        return res.redirect(req.headers.referer);
    }

    if (!validateObjectId(ticketTypeId)) {
        req.flash("error", "Invalid Ticket Type ID");
        return res.redirect(req.headers.referer);
    }

    let info = await TicketGenerationBatch.aggregate([
        { $match: { _id: new Types.ObjectId(batchId) } },
        { $unwind: "$ticketTypes" },
        { $match: { "ticketTypes.ticketTypeId": new Types.ObjectId(ticketTypeId) } },
        {
            $lookup: {
                from: "events",
                localField: "eventId",
                foreignField: "_id",
                as: "event",
            },
        },
        { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "ticket_types",
                foreignField: "_id",
                localField: "ticketTypes.ticketTypeId",
                as: "ticketType",
            },
        },
        { $unwind: { path: "$ticketType", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1, // This is the ticket generation batch ID
                eventId: "$event._id",
                eventName: "$event.name",
                eventDate: "$event.dateTime",
                ticketTypeId: "$ticketType._id",
                ticketTypeName: "$ticketType.name",
                ticketTypeCount: "$ticketTypes.ticketCount",
            },
        },
    ]);

    if (!info.length) {
        req.flash("error", "Details not found");
        return res.redirect(req.headers.referer);
    }

    info = info[0];
    // info.eventDate = dayjs(info.eventDate).format(dateTimeFormat);

    let data = {
        page: { title: `${info.ticketTypeName} Ticket Batch Overview` },
        error: req.flash("error"),
        success: req.flash("success"),
        pages: [],
        data: info,
    };

    let pages = pagesToShow(req);

    data.pages = pages;

    return res.render("panel/pages/generated-specific-ticket-type", data);
});

export const batchTicketTypeData = asyncHandler(async (req, res, next) => {
    let { batchId } = req.params;
    if (!validateObjectId(batchId)) {
        return res.status(400).json({ success: false, error: "Invalid Ticket Generation Batch ID" });
    }

    // DataTables parameters from query string
    let { ticketTypeId, draw, columns, order, start, length, search } = req.query;

    draw = parseInt(draw, 10) || 0;
    start = parseInt(start, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;
    search = search && search.value ? String(search.value.trim()) : "";

    const searchQuery = {};

    if (search.trim()) {
        searchQuery.qrData = { $regex: search, $options: "i" };
    }

    let sortQuery = {};

    if (order && order.length) {
        const columnIndexToOrder = order[0]?.column;
        const orderManner = order[0]?.dir.toLowerCase() === "asc" ? 1 : -1;
        const columnToOrder = columns[columnIndexToOrder].data || "ticketData";

        const sortableFields = ["qrData", "isVerified"];
        if (sortableFields.includes(columnToOrder)) {
            sortQuery[columnToOrder] = orderManner;
        } else {
            sortQuery["ticketData"] = 1;
        }
    } else {
        sortQuery["ticketData"] = 1;
    }

    const aggregateQuery = [
        { $match: { _id: new Types.ObjectId(batchId) } },
        { $unwind: "$ticketTypes" },
        { $match: { "ticketTypes.ticketTypeId": new Types.ObjectId(ticketTypeId) } },
        {
            $lookup: {
                from: "tickets",
                let: {
                    eventId: "$eventId",
                    ticketTypeId: "$ticketTypes.ticketTypeId",
                    generationId: "$_id",
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$eventId", "$$eventId"] },
                                    { $eq: ["$ticketGenerationBatch", "$$generationId"] },
                                    { $eq: ["$ticketTypeId", "$$ticketTypeId"] },
                                ],
                            },
                        },
                    },
                    {
                        $facet: {
                            recordsTotal: [{ $count: "count" }],
                            recordsFiltered: [{ $match: searchQuery }, { $count: "count" }],
                            data: [
                                { $match: searchQuery },
                                { $sort: sortQuery },
                                { $skip: start },
                                { $limit: length },
                                {
                                    $project: {
                                        _id: 1,
                                        qrData: 1,
                                        ticketPath: { $concat: ["/", "$ticketPath"] },
                                        isVerified: 1,
                                    },
                                },
                            ],
                        },
                    },
                ],
                as: "ticketsData",
            },
        },
        { $unwind: { path: "$ticketsData", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$ticketsData.recordsTotal", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$ticketsData.recordsFiltered", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                ticketTypeId: "$ticketTypes.ticketTypeId",
                recordsTotal: "$ticketsData.recordsTotal.count",
                recordsFiltered: "$ticketsData.recordsFiltered.count",
                data: "$ticketsData.data",
            },
        },
    ];

    // Build the aggregation pipeline
    let information = await TicketGenerationBatch.aggregate(aggregateQuery);

    if (!information.length) {
        return res.status(400).json({ success: false, error: "Details not found" });
    }

    const result = information[0];

    return res.status(200).json({
        draw: draw,
        recordsTotal: result.recordsTotal,
        recordsFiltered: result.recordsFiltered,
        data: result.data,
    });
});

export const searchAndReadClients = asyncHandler(async (req, res, next) => {
    let { search, limit, page } = req.query;

    page = parseInt(page, 10) || 1;
    if (isNaN(page) || page < 1) {
        page = 1;
    }

    limit = parseInt(limit, 10) || PAGE_LIMIT;
    if (isNaN(limit) || limit < 1) {
        limit = 10;
    }

    if (limit > 100) {
        limit = 100;
    }

    if (limit === -1) {
        limit = 0;
    }

    search = search?.trim() ? search.trim() : "";

    const searchQuery = { isDeleted: false };
    if (search) {
        searchQuery.name = { $regex: search, $options: "i" };
    }

    let clients = await Client.find(searchQuery, { name: 1 })
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    let totalDocuments = await Client.countDocuments(searchQuery);
    let totalPages = Math.ceil(totalDocuments / limit);

    return res.status(200).json({ success: true, data: { clients, totalPages, totalDocuments, page, limit } });
});

export const searchTicketVerifiers = asyncHandler(async (req, res, next) => {
    let { search, limit, page } = req.query;

    page = parseInt(page, 10) || 1;
    if (isNaN(page) || page < 1) {
        page = 1;
    }

    limit = parseInt(limit, 10) || PAGE_LIMIT;
    if (isNaN(limit) || limit < 1) {
        limit = 10;
    }

    if (limit === -1) {
        limit = 0;
    }

    search = search ? String(search.trim()) : "";

    const ticketVerifierPermission = await Permission.findOne({ uniqueName: "verify_ticket" });

    const roleExists = await UserRole.find({ permissions: { $in: [ticketVerifierPermission._id] }, isDeleted: false });

    const searchQuery = { isDeleted: false, roles: { $in: roleExists } };
    if (search) {
        searchQuery.name = { $regex: search, $options: "i" };
    }

    const ticketVerifiers = await PanelUser.find(searchQuery, { name: 1 })
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    let totalDocuments = await PanelUser.countDocuments(searchQuery);
    let totalPages = Math.ceil(totalDocuments / limit);

    return res
        .status(200)
        .json({ success: true, data: { users: ticketVerifiers, totalPages, totalDocuments, page, limit } });
});

export const searchAndReadCategory = asyncHandler(async (req, res, next) => {
    let { search, limit, page } = req.query;

    page = parseInt(page, 10) || 1;
    if (isNaN(page) || page < 1) {
        page = 1;
    }

    limit = parseInt(limit, 10) || PAGE_LIMIT;
    if (isNaN(limit) || limit < 1) {
        limit = 10;
    }

    if (limit === -1) {
        limit = 0;
    }

    search = search ? String(search.trim()) : "";

    const searchQuery = { isDeleted: false };
    if (search) {
        searchQuery.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(searchQuery, { name: 1 })
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    let totalDocuments = await Category.countDocuments(searchQuery);
    let totalPages = Math.ceil(totalDocuments / limit);

    return res.status(200).json({ success: true, data: { categories, totalPages, totalDocuments, page, limit } });
});

export const readTicketTypes = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        return res.status(400).json({ success: false, error: "Invalid Event ID" });
    }

    const eventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!eventExists) {
        return res.status(404).json({ success: false, error: "Event details not found" });
    }

    const ticketTypes = await TicketType.find({ eventId, isDeleted: false }).lean();
    ticketTypes.forEach((ticketType) => (ticketType.designPath = "/" + ticketType.designPath));

    return res.status(200).json({ success: true, ticketTypes });
});

export const readTicketType = asyncHandler(async (req, res, next) => {
    const { ticketTypeId } = req.params;
    if (!validateObjectId(ticketTypeId)) {
        return res.status(400).json({ success: false, error: "Invalid Ticket Type ID" });
    }

    const ticketType = await TicketType.findOne({ _id: ticketTypeId, isDeleted: false }).lean();
    if (!ticketType) {
        return res.status(404).json({ success: false, error: "Ticket Type details not found" });
    }

    ticketType.designPath = "/" + ticketType.designPath;

    return res.status(200).json({ success: true, ticketType });
});

export const createTicketType = asyncHandler(async (req, res, next) => {
    try {
        await new Promise((resolve, reject) => {
            imageUpload.single("image")(req, res, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }

    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        return res.status(400).json({ success: false, error: "Invalid Event ID" });
    }

    const ticketTypeDesign = req.file;
    if (!ticketTypeDesign) {
        return res.status(400).json({ success: false, error: "Ticket type design is required" });
    }

    let { name, qrData } = req.body;
    qrData = JSON.parse(qrData);

    const validation = ticketTypeSchema.safeParse({ name, qrData });
    if (!validation.success) {
        const error = validation.error.errors.map((error) => error.message);
        return res.status(400).json({ success: false, error });
    }

    const { x: left, y: top, width, height } = qrData;

    const qrDimensions = { width, height };
    const qrPositions = { left, top };

    const eventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!eventExists) {
        return res.status(400).json({ success: false, error: "Event details not found" });
    }

    const newTicketType = new TicketType({ name, qrDimensions, qrPositions, eventId });

    const ticketTypeFolder = `uploads/events/${eventExists.id}/TicketTypes`;
    if (!fs.existsSync(ticketTypeFolder)) {
        fs.mkdirSync(ticketTypeFolder);
    }

    const filePath = `${ticketTypeFolder}/${Date.now()}_${ticketTypeDesign.originalname.replaceAll(" ", "_")}`;
    fs.writeFileSync(filePath, ticketTypeDesign.buffer);

    newTicketType.set("designPath", filePath);
    await newTicketType.save();

    req.flash("success", "Ticket type created");
    return res.status(200).json({ success: true, message: "Ticket type created" });
});

export const updateTicketType = asyncHandler(async (req, res, next) => {
    try {
        await new Promise((resolve, reject) => {
            imageUpload.single("image")(req, res, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }

    const { ticketTypeId } = req.params;
    if (!validateObjectId(ticketTypeId)) {
        return res.status(400).json({ success: false, error: "Invalid Ticket Type ID" });
    }

    const ticketTypeDesign = req.file;

    let { name, qrData } = req.body;
    qrData = JSON.parse(qrData);

    const validation = ticketTypeSchema.safeParse({ name, qrData });
    if (!validation.success) {
        const error = validation.error.errors.map((error) => error.message);
        return res.status(400).json({ success: false, error });
    }

    const { x: left, y: top, width, height } = qrData;

    const qrDimensions = { width, height };
    const qrPositions = { left, top };

    const ticketTypeExists = await TicketType.findOne({ _id: ticketTypeId, isDeleted: false });
    if (!ticketTypeExists) {
        return res.status(400).json({ success: false, error: "Ticket type details not found" });
    }

    let designPath = ticketTypeExists.designPath;
    if (req.file) {
        const ticketTypeFolder = `uploads/events/${ticketTypeExists.eventId}/TicketTypes`;
        const filePath = `${ticketTypeFolder}/${Date.now()}_${ticketTypeDesign.originalname.replaceAll(" ", "_")}`;
        fs.writeFileSync(filePath, ticketTypeDesign.buffer);

        if (fs.existsSync(designPath)) {
            fs.unlinkSync(designPath);
        }

        designPath = filePath;
    }

    const updateResult = await TicketType.updateOne(
        { _id: ticketTypeId, isDeleted: false },
        { $set: { name, qrPositions, qrDimensions, designPath } }
    );

    if (!updateResult.modifiedCount) {
        return res.status(500).json({ success: true, message: "Internal server error" });
    }

    req.flash("success", "Ticket type updated");
    return res.status(200).json({ success: true, message: "Ticket type updated" });
});

export const deleteTicketType = asyncHandler(async (req, res, next) => {
    let { ticketTypeId } = req.params;

    if (!validateObjectId(ticketTypeId)) {
        req.flash("error", "Invalid Ticket Type ID");
        return res.redirect(req.headers.referer);
    }

    let ticketTypeExists = await TicketType.findOne({ _id: ticketTypeId, isDeleted: false });

    if (!ticketTypeExists) {
        req.flash("error", "Ticket type details not found");
        return res.redirect(req.headers.referer);
    }

    let updateResult = await TicketType.updateOne(
        { _id: ticketTypeId, isDeleted: false },
        { $set: { isDeleted: true } }
    );

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect(req.headers.referer);
    }

    req.flash("success", "Ticket type details removed");
    return res.redirect(req.headers.referer);
});

export const rolesPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Roles" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        showReadUi: false,
        showCreateUi: false,
        showUpdateUi: false,
        showDeleteUi: false,
    };

    if (req.isAdmin) {
        data.showReadUi = true;
        data.showCreateUi = true;
        data.showUpdateUi = true;
        data.showDeleteUi = true;
    } else {
        const showReadUi = req.userPermissions.find((permission) => permission === "read_role");
        const showCreateUi = req.userPermissions.find((permission) => permission === "create_role");
        const showUpdateUi = req.userPermissions.find((permission) => permission === "update_role");
        const showDeleteUi = req.userPermissions.find((permission) => permission === "delete_role");

        data.showReadUi = showReadUi;
        data.showCreateUi = showCreateUi;
        data.showUpdateUi = showUpdateUi;
        data.showDeleteUi = showDeleteUi;
    }

    return res.render("panel/pages/roles", data);
});

export const readRoles = asyncHandler(async (req, res, next) => {
    let { draw, start, length, search, order, columns } = req.query;

    draw = parseInt(draw, 10);
    start = parseInt(start, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;

    if (length === -1) {
        length = 0;
    }

    search = search && search.value ? String(search.value.trim()) : "";

    const matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const sortQuery = {};
    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column);
        const orderToSort = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderToSort;
        } else {
            sortQuery["createdAt"] = orderToSort;
        }
    } else {
        sortQuery["createdAt"] = 1;
    }

    const userRoleData = await UserRole.aggregate([
        { $match: { isDeleted: false } },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: matchQuery }, { $count: "count" }],
                data: [
                    { $match: matchQuery },
                    { $sort: sortQuery },
                    { $skip: start },
                    { $limit: length },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            isAdmin: 1,
                        },
                    },
                ],
            },
        },
    ]);

    const data = {
        draw,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    if (userRoleData.length) {
        data.recordsTotal = userRoleData[0].recordsTotal[0]?.count || 0;
        data.recordsFiltered = userRoleData[0].recordsFiltered[0]?.count || 0;
        data.data = userRoleData[0].data;
    }

    return res.status(200).json({ success: true, data });
});

export const readRole = asyncHandler(async (req, res, next) => {
    const { roleId } = req.params;
    if (!validateObjectId(roleId)) {
        return res.status(400).json({ success: false, error: "Invalid Role ID" });
    }

    const role = await UserRole.findOne({ _id: roleId, isDeleted: false }).populate("permissions").select("-isDeleted");

    if (!role) {
        return res.status(404).json({ success: false, error: "Role details not found" });
    }

    return res.status(200).json({ success: true, role });
});

export const createRolePage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);
    let modules = permissions;

    const data = {
        page: { title: "EvenTicket Add Role" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        modules,
    };

    return res.render("panel/pages/add-role", data);
});

export const createRole = asyncHandler(async (req, res, next) => {
    let validationResult = roleSchema.safeParse(req.body);
    if (validationResult.error) {
        let error = validationResult.error.details[0].message;
        return res.status(400).json({ success: false, error });
    }

    let { name, description, permissions } = req.body;

    let roleWithSameName = await UserRole.findOne({ name, isDeleted: false });
    if (roleWithSameName) {
        return res.status(400).json({ success: false, error: "Role with same name already exists" });
    }

    // Using a Set to avoid duplicate permission IDs
    const allPermissions = new Set();
    // Keep track of modules for which a non-read permission is provided
    const modulesNeedingRead = new Set();

    for (const permUniqueName of permissions) {
        const permissionDoc = await Permission.findOne({ uniqueName: permUniqueName });
        if (permissionDoc) {
            allPermissions.add(permissionDoc.id);
            // If it's not a read permission, note that this module requires read access too.
            if (!permissionDoc.uniqueName.startsWith("read_")) {
                modulesNeedingRead.add(permissionDoc.moduleName);
            }
        }
    }

    // For each module that has a non-read permission, ensure the read permission is added
    for (const moduleName of modulesNeedingRead) {
        // Construct the unique name for the read permission
        const readUniqueName = `read_${moduleName.toLowerCase().replaceAll(" ", "_")}`;
        const readPermissionDoc = await Permission.findOne({ uniqueName: readUniqueName });
        if (readPermissionDoc && !allPermissions.has(readPermissionDoc.id.toString())) {
            allPermissions.add(readPermissionDoc.id.toString());
        }
    }

    // Convert the Set to an array for storage
    const permissionArray = Array.from(allPermissions);

    let newRole = await UserRole.create({ name, description, permissions: permissionArray });
    if (!newRole) {
        return res.status(500).json({ success: false, error: "Internal server error" });
    }

    req.flash("success", "Role details added");
    return res.status(200).json({ success: true, message: "Role details added" });
});

export const updateRolePage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    let { roleId } = req.params;
    if (!validateObjectId(roleId)) {
        req.flash("error", "Invalid Role ID");
        return res.redirect("/panel/roles");
    }

    let modules = permissions;

    let role = await UserRole.findOne({ _id: roleId, isDeleted: false }).populate({
        path: "permissions",
        select: "_id uniqueName displayName",
    });

    if (!role) {
        req.flash("error", "Role details not found");
        return res.redirect("/panel/roles");
    }

    const data = {
        page: { title: "EvenTicket Update Role" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        modules,
        role,
    };

    return res.render("panel/pages/update-role", data);
});

export const updateRole = asyncHandler(async (req, res, next) => {
    let { roleId } = req.params;
    if (!validateObjectId(roleId)) {
        return res.status(400).json({ success: false, error: "Invalid Role ID" });
    }

    let validationResult = roleSchema.safeParse(req.body);
    if (validationResult.error) {
        let error = validationResult.error.details[0].message;
        return res.status(400).json({ success: false, error });
    }

    let roleExists = await UserRole.findOne({ _id: roleId, isDeleted: false });
    if (!roleExists) {
        return res.status(404).json({ success: false, error: "Role details not found" });
    }

    let { name, description, permissions } = req.body;

    let roleWithSameName = await UserRole.findOne({ _id: { $ne: roleId }, name, isDeleted: false });
    if (roleWithSameName) {
        return res.status(400).json({ success: false, error: "Role with same name already exists" });
    }

    // Using a Set to avoid duplicate permission IDs
    const allPermissions = new Set();
    // Keep track of modules for which a non-read permission is provided
    const modulesNeedingRead = new Set();

    for (const permUniqueName of permissions) {
        const permissionDoc = await Permission.findOne({ uniqueName: permUniqueName });
        if (permissionDoc) {
            allPermissions.add(permissionDoc.id);
            // If it's not a read permission, note that this module requires read access too.
            if (!permissionDoc.uniqueName.startsWith("read_")) {
                modulesNeedingRead.add(permissionDoc.moduleName);
            }
        }
    }

    // For each module that has a non-read permission, ensure the read permission is added
    for (const moduleName of modulesNeedingRead) {
        // Construct the unique name for the read permission
        const readUniqueName = `read_${moduleName.toLowerCase().replaceAll(" ", "_")}`;
        const readPermissionDoc = await Permission.findOne({ uniqueName: readUniqueName });
        if (readPermissionDoc && !allPermissions.has(readPermissionDoc.id.toString())) {
            allPermissions.add(readPermissionDoc.id.toString());
        }
    }

    // Convert the Set to an array for storage
    const permissionArray = Array.from(allPermissions);

    let updateResult = await UserRole.updateOne(
        { _id: roleId, isDeleted: false },
        { $set: { name, description, permissions: permissionArray } }
    );

    if (!updateResult.modifiedCount) {
        return res.status(500).json({ success: false, error: "Internal server error" });
    }

    req.flash("success", "Role details updated");
    return res.status(200).json({ success: true, message: "Role details updated" });
});

export const deleteRole = asyncHandler(async (req, res, next) => {
    let { roleId } = req.params;
    if (!validateObjectId(roleId)) {
        req.flash("error", "Invalid Role ID");
        return res.redirect("/panel/roles");
    }

    let roleExists = await UserRole.findOne({ _id: roleId, isDeleted: false, isAdmin: false });
    if (!roleExists) {
        req.flash("error", "Role details not found");
        return res.redirect("/panel/roles");
    }

    let updateResult = await UserRole.updateOne(
        { _id: roleId, isDeleted: false, isAdmin: false },
        { $set: { isDeleted: true } }
    );

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/roles");
    }

    req.flash("success", "Role details removed");
    return res.redirect("/panel/roles");
});

export const panelUsersPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);
    const roles = await UserRole.find({ isDeleted: false, isAdmin: false });

    const data = {
        page: { title: "EvenTicket Panel Users" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        showReadUi: false,
        showCreateUi: false,
        showUpdateUi: false,
        showDeleteUi: false,
        roles,
    };

    if (req.isAdmin) {
        data.showReadUi = true;
        data.showCreateUi = true;
        data.showUpdateUi = true;
        data.showDeleteUi = true;
    } else {
        const showReadUi = req.userPermissions.find((permission) => permission === "read_panel_user");
        const showCreateUi = req.userPermissions.find((permission) => permission === "create_panel_user");
        const showUpdateUi = req.userPermissions.find((permission) => permission === "update_panel_user");
        const showDeleteUi = req.userPermissions.find((permission) => permission === "delete_panel_user");

        data.showReadUi = showReadUi;
        data.showCreateUi = showCreateUi;
        data.showUpdateUi = showUpdateUi;
        data.showDeleteUi = showDeleteUi;
    }

    return res.render("panel/pages/users", data);
});

export const readPanelUsers = asyncHandler(async (req, res, next) => {
    let { draw, start, length, search, order, columns } = req.query;

    draw = parseInt(draw, 10);
    start = parseInt(start, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;

    if (length === -1) {
        length = 0;
    }

    search = search && search.value ? String(search.value.trim()) : "";

    const matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const sortQuery = {};
    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column);
        const orderToSort = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderToSort;
        } else {
            sortQuery["createdAt"] = orderToSort;
        }
    } else {
        sortQuery["createdAt"] = 1;
    }

    const userData = await PanelUser.aggregate([
        { $match: { isDeleted: false } },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: matchQuery }, { $count: "count" }],
                data: [
                    { $match: matchQuery },
                    {
                        $lookup: {
                            from: "roles",
                            foreignField: "_id",
                            localField: "roles",
                            as: "roles",
                        },
                    },
                    { $sort: sortQuery },
                    { $skip: start },
                    { $limit: length },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            isAdmin: {
                                $cond: {
                                    if: {
                                        $gt: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: "$roles",
                                                        as: "role",
                                                        cond: { $eq: ["$$role.isAdmin", true] },
                                                    },
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                    then: true,
                                    else: false,
                                },
                            },
                        },
                    },
                ],
            },
        },
    ]);

    const data = {
        draw,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    if (userData.length) {
        data.recordsTotal = userData[0].recordsTotal[0]?.count || 0;
        data.recordsFiltered = userData[0].recordsFiltered[0]?.count || 0;
        data.data = userData[0].data;
    }

    return res.status(200).json({ success: true, data });
});

export const readPanelUser = asyncHandler(async (req, res, next) => {
    const { panelUserId } = req.params;
    if (!validateObjectId(panelUserId)) {
        return res.status(400).json({ success: false, error: "Invalid Panel User ID" });
    }

    const panelUserExists = await PanelUser.findOne({ _id: panelUserId, isDeleted: false })
        .populate({
            path: "roles",
            select: "_id name isAdmin",
        })
        .select("name email roles")
        .lean();

    if (!panelUserExists) {
        return res.status(404).json({ success: false, error: "Panel user details not found" });
    }

    panelUserExists.isAdmin = panelUserExists.roles.find((role) => role.isAdmin) ? true : false;
    return res.status(200).json({ success: true, user: panelUserExists });
});

export const createPanelUser = asyncHandler(async (req, res, next) => {
    let { name, email, roles } = req.body;
    const validation = panelUserSchema.safeParse({ name, email });
    if (!validation.success) {
        const error = validation.error.errors.map((error) => error.message);
        req.flash("error", error[0]);
        return res.redirect("/panel/panel-users");
    }

    roles = Array.isArray(roles) ? roles : [roles];
    const tempRoles = [];

    const panelUserExists = await PanelUser.findOne({ email, isDeleted: false });
    if (panelUserExists) {
        req.flash("error", "Panel user details already exists");
        return res.redirect("/panel/panel-users");
    }

    for (const role of roles) {
        if (validateObjectId(role)) {
            const roleExists = await UserRole.findOne({ _id: role, isDeleted: false });
            if (roleExists) {
                tempRoles.push(role);
            }
        }
    }

    const password = hashPassword(DEFAULT_PASSWORD);
    const newPanelUser = await PanelUser.create({ name, email, roles: tempRoles, password });

    if (!newPanelUser) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/panel-users");
    }

    req.flash("success", "Panel user created");
    return res.redirect("/panel/panel-users");
});

export const updatePanelUser = asyncHandler(async (req, res, next) => {
    let { panelUserId } = req.params;
    if (!validateObjectId(panelUserId)) {
        req.flash("error", "Invalid Panel User ID");
        return res.redirect("/panel/panel-users");
    }

    let { name, email, roles } = req.body;

    let validation = panelUserSchema.safeParse({ name, email });
    if (validation.error) {
        let errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/panel/panel-users");
    }

    roles = Array.isArray(roles) ? roles : [roles];

    let userExists = await PanelUser.findOne({ _id: panelUserId, isDeleted: false }).populate("roles", "name");
    if (!userExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/panel-users");
    }

    let isAdmin = userExists.roles.some((role) => role.name === "Admin");
    if (isAdmin) {
        req.flash("error", "Admin details cannot be updated");
        return res.redirect("/panel/panel-users");
    }

    const tempRoles = [];

    for (const role of roles) {
        if (validateObjectId(role)) {
            const roleExists = await UserRole.findOne({ _id: role, isDeleted: false });
            if (roleExists) {
                tempRoles.push(role);
            }
        }
    }

    let panelUserExists = await PanelUser.findOne({ _id: { $ne: panelUserId }, email, isDeleted: false });
    if (panelUserExists) {
        req.flash("error", "Panel User with same email exists");
        return res.redirect("/panel/panel-users");
    }

    let updateResult = await PanelUser.updateOne(
        { _id: panelUserId, isDeleted: false },
        { $set: { name, email, roles: tempRoles } }
    );

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/panel-users");
    }

    req.flash("success", "Panel user details updated");
    return res.redirect("/panel/panel-users");
});

export const deletePanelUser = asyncHandler(async (req, res, next) => {
    const { panelUserId } = req.params;
    if (!validateObjectId(panelUserId)) {
        req.flash("error", "Invalid Panel User ID");
        return res.redirect("/panel/panel-users");
    }

    const panelUserExists = await PanelUser.findOne({ _id: panelUserId, isDeleted: false }).populate("roles");
    if (!panelUserExists) {
        req.flash("error", "Panel user details not found");
        return res.redirect("/panel/panel-users");
    }

    const isAdmin = panelUserExists.roles.some((role) => role.isAdmin);
    if (isAdmin) {
        req.flash("error", "Admin details cannot be removed");
        return res.redirect("/panel/panel-users");
    }

    const updateResult = await PanelUser.updateOne(
        { _id: panelUserId, isDeleted: false },
        { $set: { isDeleted: true } }
    );

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/panel/panel-users");
    }

    req.flash("success", "Panel user details removed");
    return res.redirect("/panel/panel-users");
});

export const generateTicket = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        return res.status(400).json({ success: false, error: "Invalid Event ID" });
    }

    const ticketGenerationData = req.body;

    const eventExists = await ClientEvent.findOne({ _id: eventId, isDeleted: false });
    if (!eventExists) {
        return res.status(404).json({ success: false, error: "Event details not found" });
    }

    let ticketGenerationAction = new TicketGenerationBatch({ eventId });

    const ticketTypes = [];

    for (const ticketData of ticketGenerationData) {
        const data = Object.entries(ticketData);
        if (data.length) {
            const ticketTypeId = data[0][0];
            let count = data[0][1];
            count = parseInt(count, 10);

            if (count && count > 0 && ticketTypeId && validateObjectId(ticketTypeId)) {
                const ticketTypeExists = await TicketType.findOne({ _id: ticketTypeId, eventId, isDeleted: false });
                if (ticketTypeExists) {
                    ticketTypes.push({ ticketTypeId, ticketCount: count });
                    generateQr({
                        generationId: ticketGenerationAction.id,
                        eventId,
                        ticketTypeId,
                        ticketCount: count,
                        ticketData: ticketTypeExists,
                    });
                }
            }
        }
    }

    ticketGenerationAction.ticketTypes = ticketTypes;
    await ticketGenerationAction.save();

    req.flash("success", "Tickets generated");
    return res.status(200).json({ success: true, message: "Tickets generated" });
});

export const ticketVerificationPage = asyncHandler(async (req, res, next) => {
    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Ticket Verifications" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
    };

    return res.render("panel/pages/ticket-verifications", data);
});

export const readTicketVerificationEvents = asyncHandler(async (req, res, next) => {
    let { draw, start, length, search, order, columns } = req.query;

    draw = parseInt(draw, 10) || 0;
    length = parseInt(length, 10) || PAGE_LIMIT;
    start = parseInt(start, 10) || 0;
    search = search && search.value ? String(search.value.trim()) : "";

    const sortQuery = {};
    const searchQuery = {};
    const matchQuery = { isDeleted: false };

    if (search) {
        searchQuery.name = { $regex: search, $options: "i" };
    }

    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column, 10);
        const orderManner = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name", "dateTime"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderManner;
        } else {
            sortQuery["name"] = orderManner;
        }
    } else {
        sortQuery["name"] = 1;
    }

    if (!req.isAdmin) {
        matchQuery.$or = [
            { $expr: { $eq: ["$allowAllTicketVerifiers", true] } },
            { allowedTicketVerifiers: { $in: [req.user._id] } },
        ];
    }

    const eventsData = await ClientEvent.aggregate([
        { $match: matchQuery },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: searchQuery }, { $count: "count" }],
                data: [
                    { $match: searchQuery },
                    { $sort: sortQuery },
                    { $skip: start },
                    { $limit: length },
                    { $project: { _id: 1, name: 1, dateTime: 1 } },
                ],
            },
        },
    ]);

    const data = {
        draw,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
    };

    if (eventsData && eventsData.length) {
        const temp = eventsData[0];
        data.recordsTotal = temp.recordsTotal[0]?.count || 0;
        data.recordsFiltered = temp.recordsFiltered[0]?.count || 0;
        data.data = temp.data;
    }

    return res.status(200).json({ success: true, data });
});

export const singleEventTicketVerificationPage = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Event ID");
        return res.redirect("/panel/verification");
    }

    const searchQuery = { _id: eventId, isDeleted: false };

    if (!req.isAdmin) {
        searchQuery.$or = [
            { $expr: { $eq: ["$allowAllTicketVerifiers", true] } },
            { allowedTicketVerifiers: { $in: [req.user._id] } },
        ];
    }

    const event = await ClientEvent.findOne(searchQuery);
    if (!event) {
        req.flash("error", "Event details not found.");
        return res.redirect("/panel/verification");
    }

    const pages = pagesToShow(req);

    const data = {
        page: { title: "EvenTicket Ticket Verification" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages,
        event,
    };

    return res.render("panel/pages/ticket-verification", data);
});

export const verifyTicket = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;

    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Event ID");
        return res.redirect("/panel/verification");
    }

    const searchQuery = { _id: eventId, isDeleted: false };

    if (!req.isAdmin) {
        searchQuery.$or = [
            { $expr: { $eq: ["$allowAllTicketVerifiers", true] } },
            { allowedTicketVerifiers: { $in: [req.user._id] } },
        ];
    }

    const event = await ClientEvent.findOne(searchQuery);
    if (!event) {
        req.flash("error", "Event details not found");
        return res.redirect("/panel/verification");
    }

    let { ticketData } = req.body;
    ticketData = ticketData ? String(ticketData.trim()) : "";

    if (!ticketData) {
        req.flash("error", "Invalid Ticket Data");
        return res.redirect(`/panel/verification/${event._id}`);
    }

    const ticket = await Ticket.findOne({ qrData: ticketData, eventId: event._id });

    if (!ticket) {
        req.flash("error", "Ticket details not found");
        return res.redirect(`/panel/verification/${event._id}`);
    }

    if (ticket.isVerified) {
        req.flash("error", "Ticket already verified");
        return res.redirect(`/panel/verification/${event._id}`);
    }

    ticket.set("isVerified", true);
    await ticket.save();

    req.flash("success", "Ticket verified");
    return res.redirect(`/panel/verification/${event._id}`);
});

export const downloadTickets = asyncHandler(async (req, res, next) => {
    let { batchId } = req.params;

    if (!validateObjectId(batchId)) {
        return res.status(400).json({ success: false, error: "Invalid Ticket Generation Batch ID" });
    }

    let generatedTicketsExist = await TicketGenerationBatch.findOne({ _id: batchId }).populate({ path: "eventId" });

    if (!generatedTicketsExist) {
        req.flash("error", "Generated tickets not found");
        return res.redirect(req.headers.referer);
    }

    let { eventId, createdAt } = generatedTicketsExist;
    let folderPath = `uploads/events/${eventId._id}/GeneratedTickets/${batchId}`;

    if (!folderPath && !fs.existsSync(folderPath)) {
        req.flash("error", "Generated tickets not found");
        return res.redirect(req.headers.referer);
    }

    let folderName = eventId.name.replaceAll(" ", "_");

    let { ticketTypeId } = req.query;

    if (ticketTypeId && validateObjectId(ticketTypeId)) {
        const ticketTypeExists = await TicketType.findOne({ _id: ticketTypeId, eventId, isDeleted: false });

        if (ticketTypeExists) {
            let ticketTypeFolder = `${folderPath}/${ticketTypeId}`;
            if (fs.existsSync(ticketTypeFolder)) {
                folderName = `${folderName}_${ticketTypeExists.name.replaceAll(" ", "_")}`;
                folderPath = ticketTypeFolder;
            }
        }
    }

    folderName = folderName + "_" + dayjs(createdAt).format("DDMMYYYY_HH:mm:ss:SSS");

    const zipFileName = folderName + ".zip";
    res.setHeader("Content-Disposition", `attachment; filename=${zipFileName}`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
});

export const logout = asyncHandler(async (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie("connect.sid");
        return res.redirect("/panel/login");
    });
});
