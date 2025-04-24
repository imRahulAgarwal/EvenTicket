import qr from "qrcode";
import EventTicket from "../models/ticket.js";
import { nanoid } from "nanoid";
import sharp from "sharp";
import fs from "fs";

async function generateQr({ generationId, ticketTypeId, eventId, ticketCount, ticketData }) {
    let { qrDimensions, qrPositions, designPath } = ticketData;

    let failedCount = 0;
    let successCount = 0;

    for (let index = 0; index < ticketCount; index++) {
        const qrData = nanoid(12);
        const qrBuffer = await qr.toBuffer(qrData);

        const sharpFile = await sharp(designPath).metadata();
        const ext = sharpFile.format;

        let folder = `uploads/events/${eventId}/GeneratedTickets/${generationId}/${ticketTypeId}`;

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        let imagePath = `${folder}/${qrData}.${ext}`;
        sharp(qrBuffer)
            .resize(qrDimensions.width, qrDimensions.height)
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                let image = fs.readFileSync(designPath);
                sharp(image)
                    .composite([{ input: data, left: qrPositions.left, top: qrPositions.top }])
                    .toFile(imagePath);
            })
            .then(async () => {
                let newTicket = await EventTicket.create({
                    qrData,
                    ticketPath: imagePath,
                    eventId,
                    ticketTypeId,
                    ticketGenerationBatch: generationId,
                })
                    .then(() => successCount++)
                    .catch(() => failedCount++);
            })
            .catch(() => failedCount++);
    }
}

export default generateQr;
