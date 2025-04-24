import z from "zod";

export const resetPasswordSchema = z
    .object({
        newPassword: z
            .string({ message: "New password is required" })
            .min(6, { message: "Minimum password length is 6" })
            .trim(),
        confirmPassword: z
            .string({ message: "Confirm password is required" })
            .min(6, { message: "Minimum password length is 6" })
            .trim(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords are not same",
        path: ["confirmPassword"],
    });

export const changePasswordSchema = z
    .object({
        oldPassword: z
            .string({ message: "Old password is required" })
            .min(6, { message: "Minimum password length is 6" })
            .trim(),
        newPassword: z
            .string({ message: "New password is required" })
            .min(6, { message: "Minimum password length is 6" })
            .trim(),
        confirmPassword: z
            .string({ message: "Confirm password is required" })
            .min(6, { message: "Minimum password length is 6" })
            .trim(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords are not same",
        path: ["confirmPassword"],
    });
