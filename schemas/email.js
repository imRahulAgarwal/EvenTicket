import z from "zod";

const emailSchema = z
    .string({ message: "E-Mail is required" })
    .email({ message: "Invalid E-Mail" })
    .trim()
    .toLowerCase();

export default emailSchema;
