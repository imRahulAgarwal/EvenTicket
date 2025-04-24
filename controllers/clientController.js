import asyncHandler from "../middlewares/asyncMiddleware.js";
import Client from "../models/client.js";
import ClientEvent from "../models/event.js";
import TicketType from "../models/ticket-types.js";
import { hashPassword, comparePassword } from "../utils/password.js";

export const loginPage = asyncHandler(async (req, res, next) => {});

export const login = asyncHandler(async (req, res, next) => {});

export const forgotPasswordPage = asyncHandler(async (req, res, next) => {});

export const forgotPassword = asyncHandler(async (req, res, next) => {});

export const verifyOtpPage = asyncHandler(async (req, res, next) => {});

export const verifyOtp = asyncHandler(async (req, res, next) => {});

export const resetPasswordPage = asyncHandler(async (req, res, next) => {});

export const resetPassword = asyncHandler(async (req, res, next) => {});

export const dashboardPage = asyncHandler(async (req, res, next) => {});

export const profilePage = asyncHandler(async (req, res, next) => {});

export const eventsPage = asyncHandler(async (req, res, next) => {});

export const readEvents = asyncHandler(async (req, res, next) => {});

export const eventPage = asyncHandler(async (req, res, next) => {});

export const logout = asyncHandler(async (req, res, next) => {});
