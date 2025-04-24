import crypto from "crypto";

function generateHash(data) {
    return crypto.createHash("md5").update(data).digest("hex");
}

export default generateHash;
