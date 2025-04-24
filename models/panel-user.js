import { Schema, Types, model } from "mongoose";

const panelUserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        otp: Number,
        otpExpiryTime: Date,
        expiryTimeToResetPassword: Date,
        isDeleted: { type: Boolean, default: false },
        roles: [{ type: Types.ObjectId, ref: "roles" }],
    },
    { versionKey: false, timestamps: true }
);

const PanelUser = model("panel_users", panelUserSchema);

export default PanelUser;
