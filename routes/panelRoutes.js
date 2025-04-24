import express from "express";
import * as panel from "../controllers/panelController.js";
import { checkPermission, isAuthenticated, isNotAuthenticated } from "../middlewares/authMiddlewars.js";

const panelRouter = express.Router();

panelRouter.get("/login", isNotAuthenticated, panel.loginPage);
panelRouter.post("/login", isNotAuthenticated, panel.login);

panelRouter.get("/forgot-password", isNotAuthenticated, panel.forgotPasswordPage);
panelRouter.post("/forgot-password", isNotAuthenticated, panel.forgotPassword);

panelRouter.get("/otp/verification/:userId", isNotAuthenticated, panel.verifyOtpPage);
panelRouter.post("/otp/verification/:userId", isNotAuthenticated, panel.verifyOtp);

panelRouter.get("/reset-password/:userId", isNotAuthenticated, panel.resetPasswordPage);
panelRouter.post("/reset-password/:userId", isNotAuthenticated, panel.resetPassword);

panelRouter.use(isAuthenticated);

panelRouter.get("/", panel.dashboardPage);

panelRouter.get("/profile", panel.profilePage);

panelRouter.get("/clients", checkPermission("read_client"), panel.clientsPage);
panelRouter.get("/clients/all", checkPermission("read_client"), panel.readClients);
panelRouter.get("/clients/:clientId", checkPermission("read_client"), panel.readClient);
panelRouter.get("/clients/s/:clientId", checkPermission("read_client"), panel.clientPage);
panelRouter.post("/clients", checkPermission("create_client"), panel.createClient);
panelRouter.post("/clients/update/:clientId", checkPermission("update_client"), panel.updateClient);
panelRouter.post("/clients/delete/:clientId", checkPermission("delete_client"), panel.deleteClient);

panelRouter.get("/category", checkPermission("read_category"), panel.categoryPage);
panelRouter.get("/category/all", checkPermission("read_category"), panel.readCategories);
panelRouter.get("/category/:categoryId", checkPermission("read_category"), panel.readCategory);
panelRouter.post("/category", checkPermission("create_category"), panel.createCategory);
panelRouter.post("/category/update/:categoryId", checkPermission("update_category"), panel.updateCategory);
panelRouter.post("/category/delete/:categoryId", checkPermission("delete_category"), panel.deleteCategory);

panelRouter.get("/events", checkPermission("read_event"), panel.eventsPage);
panelRouter.get("/events/all", checkPermission("read_event"), panel.readEvents);
panelRouter.get("/events/add", checkPermission("create_event"), panel.createEventPage);
panelRouter.get("/events/:eventId", checkPermission("read_event"), panel.readEvent);
panelRouter.get("/events/s/:eventId", checkPermission("read_event"), panel.eventPage);
panelRouter.post("/events", checkPermission("create_event"), panel.createEvent);
panelRouter.get("/events/update/:eventId", checkPermission("update_event"), panel.updateEventPage);
panelRouter.post("/events/update/:eventId", checkPermission("update_event"), panel.updateEvent);
panelRouter.post("/events/delete/:eventId", checkPermission("delete_event"), panel.deleteEvent);

panelRouter.get("/events/tickets/generated/batch/:eventId", checkPermission(), panel.readGeneratedTickets);
panelRouter.get("/events/tickets/generated/batch/s/:batchId", checkPermission(), panel.ticketGeneratedBatchPage);
panelRouter.get("/events/tickets/generated/batch/s/type/:batchId", checkPermission(), panel.renderBatchTicketTypePage);
panelRouter.get("/events/tickets/generated/batch/s/data/type/:batchId", checkPermission(), panel.batchTicketTypeData);

panelRouter.get("/ticket-types/all/:eventId", checkPermission(), panel.readTicketTypes);
panelRouter.get("/ticket-types/:ticketTypeId", checkPermission(), panel.readTicketType);
panelRouter.post("/ticket-types/:eventId", checkPermission(), panel.createTicketType);
panelRouter.post("/ticket-types/update/:ticketTypeId", checkPermission(), panel.updateTicketType);
panelRouter.post("/ticket-types/delete/:ticketTypeId", checkPermission(), panel.deleteTicketType);

// Routes related to add and update event details
panelRouter.get("/search/clients", checkPermission("create_event,update_event"), panel.searchAndReadClients);
panelRouter.get("/search/ticket/verifiers", checkPermission("create_event,update_event"), panel.searchTicketVerifiers);
panelRouter.get("/search/category", checkPermission("create_event,update_event"), panel.searchAndReadCategory);

panelRouter.post("/generate/tickets/:eventId", checkPermission("generate_ticket"), panel.generateTicket);
panelRouter.get("/download/tickets/:batchId", checkPermission(), panel.downloadTickets);

panelRouter.get("/verification", checkPermission("verify_ticket"), panel.ticketVerificationPage);
panelRouter.get("/verification/all", checkPermission("verify_ticket"), panel.readTicketVerificationEvents);
panelRouter.get("/verification/:eventId", checkPermission("verify_ticket"), panel.singleEventTicketVerificationPage);
panelRouter.post("/verification/:eventId/ticket", checkPermission("verify_ticket"), panel.verifyTicket);

panelRouter.get("/roles", checkPermission("read_role"), panel.rolesPage);
panelRouter.get("/roles/all", checkPermission("read_role"), panel.readRoles);
panelRouter.get("/roles/add", checkPermission("create_role"), panel.createRolePage);
panelRouter.get("/roles/:roleId", checkPermission("read_role"), panel.readRole);
panelRouter.post("/roles", checkPermission("create_role"), panel.createRole);
panelRouter.get("/roles/update/:roleId", checkPermission("update_role"), panel.updateRolePage);
panelRouter.post("/roles/update/:roleId", checkPermission("update_role"), panel.updateRole);
panelRouter.post("/roles/delete/:roleId", checkPermission("delete_role"), panel.deleteRole);

panelRouter.get("/panel-users", checkPermission("read_panel_users"), panel.panelUsersPage);
panelRouter.get("/panel-users/all", checkPermission("read_panel_users"), panel.readPanelUsers);
panelRouter.get("/panel-users/:panelUserId", checkPermission("read_panel_users"), panel.readPanelUser);
panelRouter.post("/panel-users", checkPermission("create_panel_users"), panel.createPanelUser);
panelRouter.post("/panel-users/update/:panelUserId", checkPermission("update_panel_users"), panel.updatePanelUser);
panelRouter.post("/panel-users/delete/:panelUserId", checkPermission("delete_panel_users"), panel.deletePanelUser);

export default panelRouter;
