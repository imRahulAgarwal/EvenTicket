import z from "zod";

const categorySchema = z.object({
    name: z.string({ message: "Category is required" }).trim(),
});

export default categorySchema;
