import { Types } from "mongoose";
import Category from "../models/category.js";
import ClientEvent from "../models/event.js";
import Ticket from "../models/ticket.js";
import dayjs from "dayjs";

// KPI stands for Key Permformance Indicator
export async function fetchClientKpiMetrics(clientId) {
    const curretTime = dayjs();

    const startOfDay = dayjs().startOf("day");
    const endOfDay = dayjs().endOf("day");

    const startDateOfMonth = dayjs().startOf("month");
    const endDateOfMonth = dayjs().endOf("month");

    const after7Days = dayjs().add(7, "days").endOf("day");

    const baseQuery = { isDeleted: false, clientId };

    const totalClientEvents = await ClientEvent.countDocuments(baseQuery);
    const totalClientEventsThisMonth = await ClientEvent.countDocuments({
        ...baseQuery,
        dateTime: { $gt: startDateOfMonth, $lte: endDateOfMonth },
    });
    const totalClientEventsIn7Days = await ClientEvent.countDocuments({
        ...baseQuery,
        dateTime: { $lt: after7Days, $gt: curretTime },
    });

    const clientEventTickets = await Ticket.aggregate([
        {
            $lookup: {
                from: "events",
                localField: "eventId",
                foreignField: "_id",
                as: "event",
            },
        },
        { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
        { $match: { "event.clientId": new Types.ObjectId(clientId) } },
    ]);

    const totalTicketsGenerated = clientEventTickets.length;
    const totalTicketsVerified = clientEventTickets.filter((ticket) => ticket.isVerified).length;

    const todayDataClientEventTickets = await Ticket.aggregate([
        { $match: { createdAt: { $gt: startOfDay, $lt: endOfDay } } },
        {
            $lookup: {
                from: "events",
                localField: "eventId",
                foreignField: "_id",
                as: "event",
            },
        },
        { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
        { $match: { "event.clientId": new Types.ObjectId(clientId) } },
    ]);

    const totalTicketsGeneratedToday = todayDataClientEventTickets.length;
    const totalTicketsVerifiedToday = todayDataClientEventTickets.filter((ticket) => ticket.isVerified).length;

    return {
        totalClientEvents,
        totalClientEventsThisMonth,
        totalClientEventsIn7Days,
        totalTicketsGenerated,
        totalTicketsVerified,
        totalTicketsGeneratedToday,
        totalTicketsVerifiedToday,
    };
}

export async function getEventsCountByCategory(clientId) {
    const eventCountByCategory = await Category.aggregate([
        { $match: { isDeleted: false } },
        {
            $lookup: {
                from: "events",
                let: { categoryId: "$_id", clientId: new Types.ObjectId(clientId) },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ["$$categoryId", "$categoryId"] },
                                    { $eq: ["$isDeleted", false] },
                                    { $eq: ["$clientId", "$$clientId"] },
                                ],
                            },
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
