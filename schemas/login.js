import z from "zod";

const loginSchema = z.object({
    email: z
        .string({ message: "E-Mail is required" })
        .email({ message: "Provide a valid e-mail" })
        .trim()
        .toLowerCase(),
    password: z.string({ message: "Password is required" }).trim(),
});

export default loginSchema;
