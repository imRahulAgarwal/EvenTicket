import { Schema, model } from "mongoose";

const initSchema = new Schema(
    {
        key: { type: String, unique: true },
        initialized: { type: Boolean, default: false },
        lastInitialized: { type: Date },
        permissionHash: String,
    },
    { versionKey: false }
);

const Init = model("inits", initSchema);

export default Init;
