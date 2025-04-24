const permissions = [
    {
        moduleName: "Client",
        permissions: [
            { uniqueName: "read_client", displayName: "Read Client" },
            { uniqueName: "create_client", displayName: "Create Client" },
            { uniqueName: "update_client", displayName: "Update Client" },
            { uniqueName: "delete_client", displayName: "Delete Client" },
        ],
    },
    {
        moduleName: "Category",
        permissions: [
            { uniqueName: "read_category", displayName: "Read Category" },
            { uniqueName: "create_category", displayName: "Create Category" },
            { uniqueName: "update_category", displayName: "Update Category" },
            { uniqueName: "delete_category", displayName: "Delete Category" },
        ],
    },
    {
        moduleName: "Event",
        permissions: [
            { uniqueName: "read_event", displayName: "Read Event" },
            { uniqueName: "create_event", displayName: "Create Event" },
            { uniqueName: "update_event", displayName: "Update Event" },
            { uniqueName: "delete_event", displayName: "Delete Event" },
        ],
    },
    {
        moduleName: "Event Ticket Type",
        permissions: [
            { uniqueName: "read_event_ticket_type", displayName: "Read Event Ticket Type" },
            { uniqueName: "create_event_ticket_type", displayName: "Create Event Ticket Type" },
            { uniqueName: "update_event_ticket_type", displayName: "Update Event Ticket Type" },
            { uniqueName: "delete_event_ticket_type", displayName: "Delete Event Ticket Type" },
        ],
    },
    {
        moduleName: "Panel User",
        permissions: [
            { uniqueName: "read_panel_user", displayName: "Read Panel User" },
            { uniqueName: "create_panel_user", displayName: "Create Panel User" },
            { uniqueName: "update_panel_user", displayName: "Update Panel User" },
            { uniqueName: "delete_panel_user", displayName: "Delete Panel User" },
        ],
    },
    {
        moduleName: "Event Ticket",
        permissions: [
            { uniqueName: "generate_ticket", displayName: "Generate Ticket" },
            { uniqueName: "verify_ticket", displayName: "Verify Ticket" },
            { uniqueName: "download_ticket", displayName: "Download Ticket" },
        ],
    },
];

export default permissions;
