import allModulePermissions from "../data/permissions.js";
import Init from "../models/init.js";
import Permission from "../models/permission.js";
import UserRole from "../models/role.js";
import PanelUser from "../models/panel-user.js";
import { hashPassword } from "./password.js";
import generateHash from "./generateHash.js";

async function initializeData() {
    try {
        const permissionHash = generateHash(JSON.stringify(allModulePermissions));

        let initRecord = await Init.findOne({ key: "app_init" });
        if (!initRecord) {
            const adminRoleId = await createAdminRole();
            await createAdminUser(adminRoleId);

            await createPermissions();
            initRecord = await Init.create({
                key: "app_init",
                initialized: true,
                lastInitialized: new Date(),
                permissionHash: permissionHash,
                permissionHashUpdatedAt: new Date(),
            });

            console.log("Full initialization complete.");
        } else if (!initRecord.initialized) {
            // Run one-time tasks if not initialized.
            const adminRoleId = await createAdminRole();
            await createAdminUser(adminRoleId);

            initRecord.initialized = true;
            initRecord.lastInitialized = new Date();

            // Also update the permissionHash to the current value.
            initRecord.permissionHash = permissionHash;
            initRecord.permissionHashUpdatedAt = new Date();
            await initRecord.save();
            console.log("Admin role and admin user created.");
        } else {
            console.log("Already initialized on:", initRecord.lastInitialized);
        }

        // Check if the permission configuration has changed
        if (initRecord.permissionHash !== permissionHash) {
            await createPermissions();
            initRecord.permissionHash = permissionHash;
            initRecord.permissionHashUpdatedAt = new Date();

            await initRecord.save();
            console.log("Permissions updated based on new configuration.");
        }
    } catch (error) {
        console.error("Initialization error:", error);
    }
}

async function createPermissions() {
    const permissionsOperations = [];

    for (const module of allModulePermissions) {
        for (const permission of module.permissions) {
            permissionsOperations.push({
                updateOne: {
                    filter: { uniqueName: permission.uniqueName },
                    update: { $set: { displayName: permission.displayName, moduleName: module.moduleName } },
                    upsert: true,
                    new: true,
                },
            });
        }
    }

    if (permissionsOperations.length) {
        await Permission.bulkWrite(permissionsOperations);
    }
}

async function createAdminRole() {
    // Check if the admin role already exists.
    let existingRole = await UserRole.findOne({ name: "Admin", isAdmin: true });
    if (existingRole) return existingRole._id;

    let adminRole = await UserRole.create({
        name: "Admin",
        isAdmin: true,
        description: "System Admin",
    });

    return adminRole._id;
}

async function createAdminUser(adminRoleId) {
    let { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name } = process.env;

    let admin = await PanelUser.findOne({ email });
    if (!admin) {
        let hashedPassword = hashPassword(password);
        admin = await PanelUser.create({ name, email, password: hashedPassword, roles: [adminRoleId] });
    }
}

export default initializeData;
