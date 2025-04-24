import { Schema, Types, model } from "mongoose";

const eventSchema = new Schema(
    {
        name: String,
        dateTime: Date,
        categoryId: [{ type: Types.ObjectId, ref: "category" }],
        isDeleted: { type: Boolean, default: false },
        clientId: { type: Types.ObjectId, ref: "clients" },
        allowVerificationByClient: { type: Boolean, default: false },
        allowAllTicketVerifiers: { type: Boolean, default: false },
        allowedTicketVerifiers: [{ type: Types.ObjectId, ref: "panel_users" }],
    },
    { versionKey: false, timestamps: true }
);

const ClientEvent = model("events", eventSchema);

export default ClientEvent;
