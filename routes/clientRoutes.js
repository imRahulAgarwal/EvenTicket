import express from "express";
import * as client from "../controllers/clientController.js";
import { isClientAuthenticated, isClientNotAuthenticated } from "../middlewares/authMiddlewars.js";

const clientRouter = express.Router();

clientRouter.get("/login", isClientNotAuthenticated, client.loginPage);
clientRouter.post("/login", isClientNotAuthenticated, client.login);

clientRouter.get("/forgot-password", isClientNotAuthenticated, client.forgotPasswordPage);
clientRouter.post("/forgot-password", isClientNotAuthenticated, client.forgotPassword);

clientRouter.get("/otp/verification/:userId", isClientNotAuthenticated, client.verifyOtpPage);
clientRouter.post("/otp/verification/:userId", isClientNotAuthenticated, client.verifyOtp);

clientRouter.get("/reset-password/:userId", isClientNotAuthenticated, client.resetPasswordPage);
clientRouter.post("/reset-password/:userId", isClientNotAuthenticated, client.resetPassword);

clientRouter.use(isClientAuthenticated);

clientRouter.get("/", client.dashboardPage);

clientRouter.get("/profile", client.profilePage);

clientRouter.get("/events", client.eventsPage);
clientRouter.get("/events/all", client.readEvents);
clientRouter.get("/events/:eventId", client.eventPage);

clientRouter.post("/verification/:eventId/ticket", client.verifyTicket);

clientRouter.get("/logout", client.logout);

export default clientRouter;
