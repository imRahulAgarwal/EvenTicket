import dayjs from "dayjs";
import asyncHandler from "../middlewares/asyncMiddleware.js";
import Client from "../models/client.js";
import ClientEvent from "../models/event.js";
import TicketType from "../models/ticket-type.js";
import Ticket from "../models/ticket.js";
import emailSchema from "../schemas/email.js";
import loginSchema from "../schemas/login.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import validateObjectId from "../schemas/objectId.js";
import { changePasswordSchema, resetPasswordSchema } from "../schemas/password.js";
import { Types } from "mongoose";

const PAGE_LIMIT = 10;
const TIME_ZONE = "Asia/Kolkata";
const TIME_FORMAT = "";
const sidebarLinks = [
    {
        name: "Dashboard",
        href: "/client",
        icon: '<i class="fa-solid fa-gauge icon"></i>',
        isActive: false,
    },
    {
        name: "Events",
        href: "/client/events",
        icon: '<i class="fa-solid fa-calendar-days icon"></i>',
        isActive: false,
    },
];

export const loginPage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Client Login" },
        error: req.flash("error"),
        success: req.flash("success"),
    };

    return res.render("client/login", data);
});

export const login = asyncHandler(async (req, res, next) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/client/login");
    }

    const { email, password } = validation.data;

    const userExists = await Client.findOne({ email, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/client/login");
    }

    const isSamePassword = comparePassword(password, userExists.password);
    if (!isSamePassword) {
        req.flash("error", "Invalid password");
        return res.redirect("/client/login");
    }

    req.session.user = { id: userExists._id, name: userExists.name, email: userExists.email };
    req.flash("success", "Client user login successful");
    return res.redirect("/client");
});

export const forgotPasswordPage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Client Forgot Password" },
        error: req.flash("error"),
        success: req.flash("success"),
    };

    return res.render("client/forgot-password", data);
});

export const forgotPassword = asyncHandler(async (req, res, next) => {
    const validation = emailSchema.safeParse(req.body.email);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/client/login");
    }

    const email = validation.data;

    const userExists = await Client.findOne({ email, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/client/forgot-password");
    }

    const otp = Math.round(100000 + Math.random() * 900000);
    const otpExpiryTime = dayjs().add(2, "minutes");

    // Add mail process which will be async (background task)

    userExists.set("otp", otp);
    userExists.set("otpExpiryTime", otpExpiryTime);
    await userExists.save();

    req.flash("success", "E-Mail sent successfully");
    return res.redirect(`/client/otp/verification/${userExists.id}`);
});

export const verifyOtpPage = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid User ID");
        return res.redirect("/client/forgot-password");
    }

    const userExists = await Client.findOne({ _id: userId, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/client/forgot-password");
    }

    if (!userExists.otp || !userExists.otpExpiryTime) {
        req.flash("error", "Forgot password request not found!");
        return res.redirect("/client/forgot-password");
    }

    if (dayjs(userExists.otpExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/client/forgot-password");
    }

    if (dayjs(userExists.expiryTimeToResetPassword).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/client/forgot-password");
    }

    const data = {
        page: { title: "EvenTicket OTP Verification" },
        error: req.flash("error"),
        success: req.flash("success"),
        userId,
    };

    return res.render("client/otp-verification", data);
});

export const verifyOtp = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;
    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid Client ID");
        return res.redirect("/client/forgot-password");
    }

    let { otp } = req.body;
    otp = parseInt(otp, 10);

    const userExists = await Client.findOne({ _id: userId, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/client/forgot-password");
    }

    if (userExists.otp !== otp) {
        req.flash("error", "Invalid OTP");
        return res.redirect(`/client/otp-verification/${userId}`);
    }

    if (dayjs(userExists.otpExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP Expired");
        return res.redirect("/client/forgot-password");
    }

    userExists.set("expiryTimeToResetPassword", dayjs().add(2, "minutes"));
    await userExists.save();

    req.flash("success", "OTP Verified");
    return res.redirect(`/client/reset-password/${userExists.id}`);
});

export const resetPasswordPage = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;

    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid User ID");
        return res.redirect("/client/forgot-password");
    }

    const userExists = await Client.findOne({ _id: userId, isDeleted: false });
    if (!userExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/client/forgot-password");
    }

    if (!userExists.otp || !userExists.otpExpiryTime) {
        req.flash("error", "Forgot password request not found!");
        return res.redirect("/client/forgot-password");
    }

    if (dayjs(userExists.otpExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/client/forgot-password");
    }

    if (dayjs(userExists.expiryTimeToResetPassword).valueOf() < dayjs().valueOf()) {
        req.flash("error", "OTP expired");
        return res.redirect("/client/forgot-password");
    }

    const data = {
        page: { title: "EvenTicket Cient Reset Password" },
        error: req.flash("error"),
        success: req.flash("success"),
        userId,
    };

    return res.render("client/reset-password", data);
});

export const resetPassword = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;
    if (!validateObjectId(userId)) {
        req.flash("error", "Invalid Client ID");
        return res.redirect("/client/forgot-password");
    }

    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect(`/client/reset-password/${userId}`);
    }

    const searchQuery = {
        _id: userId,
        isDeleted: false,
        otp: { $ne: null },
        otpExpiryTime: { $ne: null },
    };

    const userExists = await Client.findOne(searchQuery);

    if (!userExists) {
        req.flash("error", "Client details not found");
        return res.redirect("/client/forgot-password");
    }

    if (dayjs(userExists.resetPasswordExpiryTime).valueOf() < dayjs().valueOf()) {
        req.flash("error", "Time to reset password has expired, try again");
        return res.redirect("/client/forgot-password");
    }

    const { newPassword } = validation.data;
    const hashedPassword = hashPassword(newPassword);

    const updateQuery = {
        $set: { password: hashedPassword },
        $unset: { otp: 1, otpExpiryTime: 1, resetPasswordExpiryTime: 1 },
    };

    const updateResult = await Client.updateOne(searchQuery, updateQuery);

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/client/forgot-password");
    }

    req.flash("success", "Password resetted successfully.");
    return res.redirect("/client/login");
});

export const dashboardPage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Client Dashboard" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages: sidebarLinks.map((link) => {
            if (link.name === "Dashboard") {
                link.isActive = true;
            } else {
                link.isActive = false;
            }

            return link;
        }),
    };

    return res.render("client/pages/dashboard", data);
});

export const profilePage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Client Profile" },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages: sidebarLinks,
    };

    return res.render("client/pages/profile", data);
});

export const changePassword = asyncHandler(async (req, res, next) => {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
        const errors = validation.error.errors.map((error) => error.message);
        req.flash("error", errors[0]);
        return res.redirect("/client");
    }

    const user = req.user;
    const { oldPassword, newPassword } = validation.data;

    const isSamePassword = comparePassword(oldPassword, user.password);
    if (!isSamePassword) {
        req.flash("error", "Invalid Password");
        return res.redirect("/client");
    }

    const hashedPassword = hashPassword(newPassword);

    const updateResult = await Client.updateOne(
        { _id: user._id, isDeleted: false },
        { $set: { password: hashedPassword } }
    );

    if (!updateResult.modifiedCount) {
        req.flash("error", "Internal server error");
        return res.redirect("/client");
    }

    req.flash("success", "Password changed successfully");
    return res.redirect("/client");
});

export const eventsPage = asyncHandler(async (req, res, next) => {
    const data = {
        page: { title: "EvenTicket Client Events", isActive: true },
        error: req.flash("error"),
        success: req.flash("success"),
        user: req.session.user,
        pages: sidebarLinks.map((link) => {
            if (link.name === "Events") {
                link.isActive = true;
            } else {
                link.isActive = false;
            }

            return link;
        }),
    };

    return res.render("client/pages/events", data);
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

    const clientId = req.session.user.id;
    const matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const sortQuery = {};
    if (order && order.length) {
        const columnIndexToOrder = parseInt(order[0].column);
        const orderToSort = order[0].dir === "asc" ? 1 : -1;
        const columnToSort = columns[columnIndexToOrder].data || columns[columnIndexToOrder].name;

        const sortableFields = ["name", "dateTime"];
        if (sortableFields.includes(columnToSort)) {
            sortQuery[columnToSort] = orderToSort;
        } else {
            sortQuery["name"] = orderToSort;
        }
    } else {
        sortQuery["name"] = 1;
    }

    const clientEventData = await ClientEvent.aggregate([
        { $match: { isDeleted: false, clientId: new Types.ObjectId(clientId) } },
        {
            $facet: {
                recordsTotal: [{ $count: "count" }],
                recordsFiltered: [{ $match: matchQuery }, { $count: "count" }],
                data: [
                    { $match: matchQuery },
                    { $sort: sortQuery },
                    { $skip: start },
                    ...(length ? [{ $limit: length }] : []),
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            dateTime: 1,
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

    if (clientEventData.length) {
        data.recordsTotal = clientEventData[0].recordsTotal[0]?.count || 0;
        data.recordsFiltered = clientEventData[0].recordsFiltered[0]?.count || 0;
        data.data = clientEventData[0].data;
    }

    return res.status(200).json({ success: true, data });
});

export const eventPage = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Event ID");
        return res.redirect("/client/events");
    }

    let event = await ClientEvent.aggregate([
        {
            $match: {
                _id: new Types.ObjectId(eventId),
                clientId: new Types.ObjectId(req.session.user.id),
                isDeleted: false,
            },
        },
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
                categoryName: "$category.name",
                allowVerificationByClient: 1,
            },
        },
    ]);

    if (!event.length) {
        req.flash("error", "Client event details not found");
        return res.redirect("/client/events");
    }

    event = event[0];

    const data = {
        page: { title: "EvenTicket Client Event" },
        error: req.flash("error"),
        success: req.flash("success"),
        event,
        pages: sidebarLinks,
    };

    return res.render("client/pages/event", data);
});

export const verifyTicket = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;

    if (!validateObjectId(eventId)) {
        req.flash("error", "Invalid Event ID");
        return res.redirect("/client/events");
    }

    const clientId = req.session.user.id;
    const searchQuery = { _id: eventId, isDeleted: false, clientId };

    const event = await ClientEvent.findOne(searchQuery);
    if (!event) {
        req.flash("error", "Event details not found");
        return res.redirect("/client/events");
    }

    if (!event.allowVerificationByClient) {
        req.flash("error", "Verification cannot be done! Contact Admin");
        return res.redirect(`/client/events/${eventId}`);
    }

    let { ticketData } = req.body;
    ticketData = ticketData ? String(ticketData.trim()) : "";

    if (!ticketData) {
        req.flash("error", "Invalid Ticket Data");
        return res.redirect(`/client/events/${eventId}`);
    }

    const ticket = await Ticket.findOne({ qrData: ticketData, eventId: event._id });

    if (!ticket) {
        req.flash("error", "Ticket details not found");
        return res.redirect(`/client/events/${eventId}`);
    }

    if (ticket.isVerified) {
        req.flash("error", "Ticket already verified");
        return res.redirect(`/client/events/${eventId}`);
    }

    ticket.set("verifiedAt", dayjs());
    ticket.set("isVerified", true);
    ticket.set("verifiedFromClientView", true);
    await ticket.save();

    req.flash("success", "Ticket verified");
    return res.redirect(`/client/events/${eventId}`);
});

export const logout = asyncHandler(async (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie("connect.sid");
        return res.redirect("/client/login");
    });
});
