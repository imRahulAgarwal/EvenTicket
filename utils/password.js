import bcrypt from "bcrypt";

export function hashPassword(password) {
    let hashedPassword = bcrypt.hashSync(password, 10);
    return hashedPassword;
}

export function comparePassword(password, encryptedPassword) {
    let isValidPassword = bcrypt.compareSync(password, encryptedPassword);
    return isValidPassword;
}
