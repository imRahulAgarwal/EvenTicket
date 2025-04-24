import z from "zod";

const panelUserSchema = z.object({
    name: z.string({ message: "User name is required" }).trim(),
    email: z.string({ message: "User email is required" }).trim().toLowerCase(),
});

export default panelUserSchema;
