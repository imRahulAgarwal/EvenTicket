import z from "zod";

const ticketTypeSchema = z.object({
    name: z.string({ message: "Ticket type name is required" }).trim(),
    qrData: z.object({
        x: z
            .number({ message: "X-Axis is required (Left)" })
            .gte(0, { message: "X-Axis value must be greater than or equal to 0" }),

        y: z
            .number({ message: "Y-Axis is required (Top)" })
            .gte(0, { message: "Y-Axis value must be greater than or equal to 0" }),

        width: z
            .number({ message: "QR Code width is required" })
            .gt(0, { message: "QR Code width must be greater than 0" }),

        height: z
            .number({ message: "QR Code height is required" })
            .gt(0, { message: "QR Code height must be greater than 0" }),
    }),
});

export default ticketTypeSchema;
