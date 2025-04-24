import z from "zod";

const clientSchema = z.object({
    name: z.string({ message: "Client name is required" }).trim(),
    email: z.string({ message: "Client email is required" }).trim().toLowerCase(),
    number: z.string({ message: "Client number is required" }).trim().max(10, "Max length of number is 10").trim(),
});

export default clientSchema;
