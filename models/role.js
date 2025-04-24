import { Schema, Types, model } from "mongoose";

const roleSchema = new Schema(
    {
        name: String,
        description: String,
        permissions: [{ type: Types.ObjectId, ref: "permissions" }],
        isDeleted: { type: Boolean, default: false },
        isAdmin: { type: Boolean, default: false },
    },
    { versionKey: false, timestamps: true }
);

const UserRole = model("roles", roleSchema);

export default UserRole;
