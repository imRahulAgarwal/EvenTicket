import { Schema, Types, model } from "mongoose";

const ticketGenerationBatchSchema = new Schema(
    {
        eventId: { type: Types.ObjectId, ref: "events" },
        ticketTypes: [
            {
                ticketTypeId: { type: Types.ObjectId, ref: "ticket_types" },
                ticketCount: Number,
            },
        ],
    },
    { versionKey: false, timestamps: true }
);

const TicketGenerationBatch = model(
    "ticket_generation_batches",
    ticketGenerationBatchSchema,
    "ticket_generation_batches"
);

export default TicketGenerationBatch;
