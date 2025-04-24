import z from "zod";

const roleSchema = z.object({
    name: z.string({ message: "Role name is required" }).nonempty({ message: "Role name is required" }).trim(),
    description: z.string().trim().optional(),
});

export default roleSchema;
