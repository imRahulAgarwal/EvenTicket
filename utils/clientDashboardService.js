import { Types } from "mongoose";
import ClientEvent from "../models/event.js";
import dayjs from "dayjs";

// KPI stands for Key Permformance Indicator
export async function fetchClientKpiMetrics(clientId) {
    const curretTime = dayjs().toDate();

    const startOfDay = dayjs().startOf("day").toDate();
    const endOfDay = dayjs().endOf("day").toDate();

    const startDateOfMonth = dayjs().startOf("month").toDate();
    const endDateOfMonth = dayjs().endOf("month").toDate();

    const after7Days = dayjs().add(7, "days").endOf("day").toDate();

    const baseQuery = { isDeleted: false, clientId };

    const [totalClientEvents, totalClientEventsThisMonth, totalClientEventsIn7Days, clientEventTickets] =
        await Promise.all([
            ClientEvent.countDocuments(baseQuery),
            ClientEvent.countDocuments({ ...baseQuery, dateTime: { $gt: startDateOfMonth, $lte: endDateOfMonth } }),
            ClientEvent.countDocuments({ ...baseQuery, dateTime: { $lt: after7Days, $gt: curretTime } }),
            ClientEvent.aggregate([
                { $match: { isDeleted: false, clientId: new Types.ObjectId(clientId) } },
                {
                    $lookup: {
                        from: "tickets",
                        let: { eventId: "$_id" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$eventId", "$$eventId"] } } },
                            {
                                $facet: {
                                    generatedTickets: [{ $count: "count" }],
                                    verifiedTickets: [{ $match: { isVerified: true } }, { $count: "count" }],
                                    generatedTicketsToday: [
                                        { $match: { createdAt: { $gt: startOfDay, $lt: endOfDay } } },
                                        { $count: "count" },
                                    ],
                                    verifiedTicketsToday: [
                                        { $match: { createdAt: { $gt: startOfDay, $lt: endOfDay }, isVerified: true } },
                                        { $count: "count" },
                                    ],
                                },
                            },
                            { $unwind: { path: "$generatedTickets", preserveNullAndEmptyArrays: true } },
                            { $unwind: { path: "$verifiedTickets", preserveNullAndEmptyArrays: true } },
                            { $unwind: { path: "$generatedTicketsToday", preserveNullAndEmptyArrays: true } },
                            { $unwind: { path: "$verifiedTicketsToday", preserveNullAndEmptyArrays: true } },
                            {
                                $addFields: {
                                    generatedTickets: { $ifNull: ["$generatedTickets.count", 0] },
                                    verifiedTickets: { $ifNull: ["$verifiedTickets.count", 0] },
                                    generatedTicketsToday: { $ifNull: ["$generatedTicketsToday.count", 0] },
                                    verifiedTicketsToday: { $ifNull: ["$verifiedTicketsToday.count", 0] },
                                },
                            },
                        ],
                        as: "ticketCount",
                    },
                },
                { $unwind: { path: "$ticketCount", preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: "$clientId",
                        totalTickets: { $sum: "$ticketCount.generatedTickets" },
                        verifiedTickets: { $sum: "$ticketCount.verifiedTickets" },
                        generatedTicketsToday: { $sum: "$ticketCount.generatedTicketsToday" },
                        verifiedTicketsToday: { $sum: "$ticketCount.verifiedTicketsToday" },
                    },
                },
            ]),
        ]);

    const totalTicketsGenerated = clientEventTickets[0].totalTickets;
    const totalTicketsVerified = clientEventTickets[0].verifiedTickets;

    const totalTicketsGeneratedToday = clientEventTickets[0].generatedTicketsToday;
    const totalTicketsVerifiedToday = clientEventTickets[0].verifiedTicketsToday;

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
    const eventCountByCategory = await ClientEvent.aggregate([
        { $match: { isDeleted: false, clientId: new Types.ObjectId(clientId) } },
        { $unwind: { path: "$categoryId", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$categoryId", eventCount: { $sum: 1 } } },
        { $lookup: { from: "category", localField: "_id", foreignField: "_id", as: "categoryInfo" } },
        { $unwind: "$categoryInfo" },
        { $project: { _id: 0, name: "$categoryInfo.name", eventCount: 1 } },
    ]);

    return eventCountByCategory;
}
