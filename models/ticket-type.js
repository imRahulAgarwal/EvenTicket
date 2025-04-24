import { Schema, Types, model } from "mongoose";

const ticketTypeSchema = new Schema(
    {
        name: String,
        designPath: String,
        qrDimensions: {
            width: Number,
            height: Number,
        },
        qrPositions: {
            top: Number,
            left: Number,
        },
        isDeleted: { type: Boolean, default: false },
        eventId: { type: Types.ObjectId, ref: "events" },
    },
    { versionKey: false, timestamps: true }
);

const TicketType = model("ticket_types", ticketTypeSchema);

export default TicketType;
