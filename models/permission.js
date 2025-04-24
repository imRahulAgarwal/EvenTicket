import { Schema, model } from "mongoose";

const permissionSchema = new Schema(
    {
        uniqueName: String,
        moduleName: String,
        displayName: String,
    },
    { timestamps: true, versionKey: false }
);

const Permission = model("permissions", permissionSchema);

export default Permission;
