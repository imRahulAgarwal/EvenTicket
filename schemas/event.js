import { z } from "zod";

const eventSchema = z.object({
    name: z.string({ required_error: "Event name is required" }).trim().min(1, { message: "Event name is required" }),
    date: z.coerce.date({ invalid_type_error: "Event date is required" }).refine((date) => date > new Date(), {
        message: "Invalid event date provided",
    }),
    allowVerificationByClient: z
        .enum(["true", "false"], {
            required_error: "Verification option is required",
            invalid_type_error: "Invalid value provided for verification option",
        })
        .transform((val) => val === "true"),
    allowAllTicketVerifiers: z
        .enum(["true", "false"], {
            required_error: "All verifiers option is required",
            invalid_type_error: "Invalid value provided for all verifiers option",
        })
        .transform((val) => val === "true"),
});

export default eventSchema;
