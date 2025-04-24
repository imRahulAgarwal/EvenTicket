import { Schema, model } from "mongoose";

const clientSchema = new Schema(
    {
        name: String,
        email: String,
        number: String,
        password: String,
        otp: Number,
        otpExpiryTime: Date,
        expiryTimeToResetPassword: Date,
        isDeleted: { type: Boolean, default: false },
    },
    { versionKey: false, timestamps: true }
);

const Client = model("clients", clientSchema);

export default Client;
