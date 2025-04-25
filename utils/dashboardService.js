import Category from "../models/category.js";
import Client from "../models/client.js";
import ClientEvent from "../models/event.js";
import Init from "../models/init.js";
import PanelUser from "../models/panel-user.js";
import UserRole from "../models/role.js";
import Permission from "../models/permission.js";
import TicketGenerationBatch from "../models/ticket-generation-batch.js";
import Ticket from "../models/ticket.js";
import TicketType from "../models/ticket-type.js";
import dayjs from "dayjs";

// KPI stands for Key Permformance Indicator
export async function fetchKpiMetrics() {
    const curretTime = dayjs();

    const startOfDay = dayjs().startOf("day");
    const endOfDay = dayjs().endOf("day");

    const startDateOfMonth = dayjs().startOf("month");
    const endDateOfMonth = dayjs().endOf("month");

    const before7Days = dayjs().subtract(7, "days").startOf("day");
    const after7Days = dayjs().add(7, "days").endOf("day");

    const kpiData = await Promise.all([
        Client.countDocuments({ isDeleted: false }), // Total Clients
        Client.countDocuments({ isDeleted: false, createdAt: { $gt: startDateOfMonth, $lte: endDateOfMonth } }), // Total Clients this Month
        Client.countDocuments({ isDeleted: false, createdAt: { $gt: before7Days } }), // Total Clients in Past 7 Days

        ClientEvent.countDocuments({ isDeleted: false }), // Total Events
        ClientEvent.countDocuments({ isDeleted: false, dateTime: { $gt: startDateOfMonth, $lte: endDateOfMonth } }), // Total Events this Month
        ClientEvent.countDocuments({ isDeleted: false, dateTime: { $lt: after7Days, $gt: curretTime } }), // Total Events in Upcoming 7 Days

        Ticket.countDocuments(), // Total Tickets Generated
        Ticket.countDocuments({ isVerified: true }), // Total Tickets Verified
        Ticket.countDocuments({ createdAt: { $gt: startOfDay, $lt: endOfDay } }), // Total Tickets Generated Today
        Ticket.countDocuments({ createdAt: { $gt: startOfDay, $lt: endOfDay }, isVerified: true }), // Total Tickets Verified Today

        UserRole.countDocuments({ isDeleted: false }), // Total User Roles
        PanelUser.countDocuments({ isDeleted: false }), // Total Panel Users
    ]);

    const [
        totalClients,
        totalClientsThisMonth,
        totalClientsInLast7Days,
        totalEvents,
        totalEventsThisMonth,
        totalUpcomingEventsIn7Days,
        totalTicketsGenerated,
        totalTicketsVerified,
        totalTicketsGeneratedToday,
        totalTicketsVerifiedToday,
        totalUserRoles,
        totalPanelUsers,
    ] = kpiData;

    return {
        totalClients,
        totalClientsThisMonth,
        totalClientsInLast7Days,
        totalEvents,
        totalEventsThisMonth,
        totalUpcomingEventsIn7Days,
        totalTicketsGenerated,
        totalTicketsVerified,
        totalTicketsGeneratedToday,
        totalTicketsVerifiedToday,
        totalUserRoles,
        totalPanelUsers,
    };
}

export async function fetchUpcomingEventData() {
    const upcomingEvents = await ClientEvent.aggregate([
        { $match: { isDeleted: false, dateTime: { $gt: dayjs().toDate() } } },
        { $sort: { dateTime: 1 } },
        { $limit: 5 },
        { $lookup: { from: "clients", foreignField: "_id", localField: "clientId", as: "client" } },
        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "category", foreignField: "_id", localField: "categoryId", as: "categories" } },
        {
            $lookup: {
                from: "tickets",
                let: { eventId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$eventId", "$$eventId"] } } },
                    {
                        $facet: {
                            totalTicketsGenerated: [{ $count: "count" }],
                            totalTicketsVerified: [{ $match: { isVerified: true } }, { $count: "count" }],
                        },
                    },
                    { $unwind: { path: "$totalTicketsGenerated", preserveNullAndEmptyArrays: true } },
                    { $unwind: { path: "$totalTicketsVerified", preserveNullAndEmptyArrays: true } },
                    {
                        $addFields: {
                            totalTicketsGenerated: { $ifNull: ["$totalTicketsGenerated.count", 0] },
                            totalTicketsVerified: { $ifNull: ["$totalTicketsVerified.count", 0] },
                        },
                    },
                    {
                        $addFields: {
                            ticketVerificationRate: {
                                $cond: {
                                    if: { $ne: ["$totalTicketsGenerated", 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $round: {
                                                    $divide: ["$totalTicketsVerified", "$totalTicketsGenerated"],
                                                },
                                            },
                                            100,
                                        ],
                                    },
                                    else: 0,
                                },
                            },
                        },
                    },
                ],
                as: "ticketsData",
            },
        },
        { $unwind: { path: "$ticketsData", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                eventName: "$name",
                eventDateTime: "$dateTime",
                clientId: "$client._id",
                clientName: "$client.name",
                categories: 1,
                allowVerificationByClient: 1,
                allowAllTicketVerifiers: 1,
                allowedTicketVerifiers: 1,
                ticketsData: 1,
            },
        },
    ]);

    return upcomingEvents;
}

export async function fetchPastEventData() {
    const upcomingEvents = await ClientEvent.aggregate([
        { $match: { isDeleted: false, dateTime: { $lt: dayjs().toDate() } } },
        { $sort: { dateTime: 1 } },
        { $limit: 5 },
        { $lookup: { from: "clients", foreignField: "_id", localField: "clientId", as: "client" } },
        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "category", foreignField: "_id", localField: "categoryId", as: "categories" } },
        {
            $lookup: {
                from: "tickets",
                let: { eventId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$eventId", "$$eventId"] } } },
                    {
                        $facet: {
                            totalTicketsGenerated: [{ $count: "count" }],
                            totalTicketsVerified: [{ $match: { isVerified: true } }, { $count: "count" }],
                        },
                    },
                    { $unwind: { path: "$totalTicketsGenerated", preserveNullAndEmptyArrays: true } },
                    { $unwind: { path: "$totalTicketsVerified", preserveNullAndEmptyArrays: true } },
                    {
                        $addFields: {
                            totalTicketsGenerated: { $ifNull: ["$totalTicketsGenerated", 0] },
                            totalTicketsVerified: { $ifNull: ["$totalTicketsVerified", 0] },
                        },
                    },
                    {
                        $addFields: {
                            ticketVerificationRate: {
                                $cond: {
                                    if: { $ne: ["$totalTicketsGenerated", 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $round: {
                                                    $divide: ["$totalTicketsVerified", "$totalTicketsGenerated"],
                                                },
                                            },
                                            100,
                                        ],
                                    },
                                    else: 0,
                                },
                            },
                        },
                    },
                ],
                as: "ticketsData",
            },
        },
        { $unwind: { path: "$ticketsData", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1,
                eventName: "$name",
                eventDateTime: "$dateTime",
                clientId: "$client._id",
                clientName: "$client.name",
                categories: 1,
                allowVerificationByClient: 1,
                allowAllTicketVerifiers: 1,
                allowedTicketVerifiers: 1,
                ticketsData: 1,
            },
        },
    ]);

    return upcomingEvents;
}

export async function getEventsCountByCategory() {
    const eventCountByCategory = await Category.aggregate([
        { $match: { isDeleted: false } },
        {
            $lookup: {
                from: "events",
                let: { categoryId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $and: [{ $in: ["$$categoryId", "$categoryId"] }, { $eq: ["$isDeleted", false] }] },
                        },
                    },
                ],
                as: "events",
            },
        },
        { $project: { _id: 1, name: 1, eventCount: { $size: "$events" } } },
    ]);

    return eventCountByCategory;
}

export async function getEventsCountByTop10Clients() {
    const eventCountByClient = await Ticket.aggregate([
        // 1. Join in the Event to get its clientId
        { $lookup: { from: "events", localField: "eventId", foreignField: "_id", as: "event" } },
        { $unwind: "$event" },

        // 2. Group by event.clientId, count tickets
        { $group: { _id: "$event.clientId", ticketCount: { $sum: 1 } } },

        // 3. Sort & limit
        { $sort: { ticketCount: -1 } },
        { $limit: 10 },

        // 4. Lookup client details
        { $lookup: { from: "clients", localField: "_id", foreignField: "_id", as: "client" } },
        { $unwind: "$client" },

        // 5. Project only what we need
        { $project: { _id: 0, clientId: "$_id", clientName: "$client.name", ticketCount: 1 } },
    ]);

    return eventCountByClient;
}

export async function getPanelUsersCountFromUserRole() {
    const panelUsersCount = await UserRole.aggregate([
        { $match: { isDeleted: false, isAdmin: false } },
        {
            $lookup: {
                from: "panel_users",
                let: { userRoleId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $and: [{ $in: ["$$userRoleId", "$roles"] }, { $eq: ["$isDeleted", false] }] },
                        },
                    },
                ],
                as: "panelUsers",
            },
        },
        { $project: { _id: 1, name: 1, panelUsersCount: { $size: "$panelUsers" } } },
    ]);

    return panelUsersCount;
}
