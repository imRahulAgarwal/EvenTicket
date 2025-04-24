import { Schema, Types, model } from "mongoose";

const ticketSchema = new Schema(
    {
        qrData: String,
        ticketPath: String,
        eventId: { type: Types.ObjectId, ref: "events" },
        ticketTypeId: { type: Types.ObjectId, ref: "ticket_types" },
        ticketGenerationBatch: { type: Types.ObjectId, ref: "ticket_generation_batches" },
        isVerified: { type: Boolean, default: false },
        verifiedAt: Date,
        verifiedFromClientView: Boolean,
    },
    { versionKey: false, timestamps: true }
);

const Ticket = model("tickets", ticketSchema);

export default Ticket;
