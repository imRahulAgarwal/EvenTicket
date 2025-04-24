// tt -> Ticket Type
// tti -> Ticket Type Image

$(document).ready(function () {
    let ttModal = $("#ticketTypeModal"); // Ticket Type Modal
    let addTTBtn = $("#addTicketTypeButton"); // New Ticket Type Button

    let ttiCanvas = $("#canvas").get(0); // Canvas in the Create/Update Ticket Type Modal
    let ttiContext = ttiCanvas.getContext("2d");
    let formSubmitButton = $("#submitButton"); // Form submission button
    const minBoxSize = 20;

    let ttRow = $("#ticketTypeRow"); // Row in which all the ticket types will be displayed

    let image = new Image();
    let scale = 1;
    let currentImageBlob = undefined;

    let qrBox = {
        top: 50,
        left: 50,
        width: 50,
        height: 50,
    };

    let isDragging = false;
    let isResizing = false;
    let startX, startY, activeResizeCorner;

    // When New Ticket Type Button is clicked
    addTTBtn.on("click", function () {
        let ttModalLabel = ttModal.find("#ticketTypeModalLabel");
        ttModalLabel.text("New Ticket Type");
        let eventId = window.location.href.split("/s/")[1];

        let actionUrl = `/panel/ticket-types/${eventId}`;
        let ttForm = ttModal.find("#ticketTypeForm");
        ttForm.attr("action", actionUrl);

        ttModal.modal("show");
    });

    // When View Ticket Design Button is clicked
    ttRow.on("click", ".viewDesignButton", function () {
        let imgSrc = $(this).data("image");
        let qrPositions = $(this).data("qr-positions");
        let qrDimensions = $(this).data("qr-dimensions");

        let ttDesignImage = new Image();
        let ttDesignCanvas = $("#designCanvas").get(0);
        let ttdCtx = ttDesignCanvas.getContext("2d");

        ttDesignImage.onload = function () {
            // Set canvas width to the image's actual width
            ttDesignCanvas.width = ttDesignImage.width;
            ttDesignCanvas.height = ttDesignImage.height;

            // Draw the image without distortion
            ttdCtx.clearRect(0, 0, ttDesignCanvas.width, ttDesignCanvas.height);
            ttdCtx.drawImage(ttDesignImage, 0, 0, ttDesignImage.width, ttDesignImage.height);

            // Draw QR Code box
            ttdCtx.strokeStyle = "red";
            ttdCtx.lineWidth = 5;
            ttdCtx.strokeRect(qrPositions.left, qrPositions.top, qrDimensions.width, qrDimensions.height);
        };

        ttDesignImage.src = imgSrc;

        let ttDesignModal = $("#designModal");
        ttDesignModal.modal("show");
    });

    // When Edit Ticket Design Button is clicked
    ttRow.on("click", ".editTicketTypeButton", function () {
        let ticketTypeId = $(this).data("ticket-type-id");

        if (!ticketTypeId) {
            return;
        }

        $.ajax(`/panel/ticket-types/${ticketTypeId}`, {
            method: "GET",
            dataType: "json",
            headers: { "Content-Type": "application/json" },
            success: function (data, text, xhr) {
                if (data.success) {
                    let ticketType = data.ticketType;

                    ttModal.find("#name").val(ticketType.name);

                    let actionUrl = `/panel/ticket-types/update/${ticketTypeId}`;
                    ttModal.find("#ticketTypeForm").attr("action", actionUrl);

                    image.onload = () => {
                        const maxCanvasWidth = 450;
                        scale = Math.min(1, maxCanvasWidth / image.width);

                        qrBox = {
                            left: Math.round(ticketType.qrPositions.left * scale),
                            top: Math.round(ticketType.qrPositions.top * scale),
                            width: Math.round(ticketType.qrDimensions.width * scale),
                            height: Math.round(ticketType.qrDimensions.height * scale),
                        };

                        ttiCanvas.width = image.width * scale;
                        ttiCanvas.height = image.height * scale;

                        drawCanvas();
                    };

                    image.src = ticketType.designPath;

                    ttModal.find("#ticketTypeModalLabel").text("Update Ticket Type");
                    ttModal.find("#image").hide();
                    showChangeImageButton();

                    ttModal.modal("show");
                }
            },
            error: function (xhr, text) {
                let data = xhr.responseJSON;
                toastr.error(data.error);
            },
        });
    });

    // When Delete Ticket Deisgn Button is clicked
    ttRow.on("click", ".deleteTicketTypeButton", function () {
        let ticketTypeId = $(this).data("ticket-type-id");

        if (!ticketTypeId) {
            return;
        }

        let confirmationModal = $("#confirmationModal");
        confirmationModal.find("form").attr("action", `/panel/ticket-types/delete/${ticketTypeId}`);
        confirmationModal.attr("aria-hidden", false);
        confirmationModal.modal("show");
    });

    // When Generate Ticket Button is clicked
    ttRow.on("click", ".generateTicketTypeButton", function () {
        let ticketTypeId = $(this).data("ticket-type-id");

        if (!ticketTypeId) {
            return;
        }

        let generateTicketModal = $("#generateTicketModal");
        generateTicketModal.attr("aria-hidden", false);
        generateTicketModal.modal("show");

        generateTicketModal.find("#ticketTypeSelect").val(ticketTypeId);
    });

    let generateTicketForm = $("#generateTicketForm");

    generateTicketForm.on("submit", function (e) {
        e.preventDefault();
        let actionUrl = generateTicketForm.attr("action");

        let ticketsToGenerate = [];
        let ticketTypeId = generateTicketForm.find("#ticketTypeSelect").val();
        let numberOfTicketsToGenerate = generateTicketForm.find("#ticketsToGenerate").val();

        ticketsToGenerate.push({ [ticketTypeId]: numberOfTicketsToGenerate });

        $.ajax({
            url: actionUrl,
            method: "POST",
            data: JSON.stringify(ticketsToGenerate),
            dataType: "json",
            contentType: "application/json",
            success: function (data, text, xhr) {
                window.location.reload();
            },
            error: function (xhr, text) {
                let data = xhr.responseJSON;
                toastr.error(data.error);
            },
        });
    });

    ttModal.on("show.bs.modal", function () {
        ttModal.attr("aria-hidden", false);
    });

    ttModal.on("click", ".changeImageButton", function () {
        resetCanvas();
        showImageInputField();
    });

    function showChangeImageButton() {
        let changeImageButton = $("<button>");
        changeImageButton.attr("type", "button");
        changeImageButton.attr("class", "btn btn-warning w-100 mt-2 changeImageButton");
        changeImageButton.text("Change Image");
        ttModal.find("#image").replaceWith(changeImageButton);
    }

    function showImageInputField() {
        let imageInput = $("<input>");
        imageInput.attr("type", "file");
        imageInput.attr("class", "form-control");
        imageInput.attr("accept", "image/*");
        imageInput.attr("required", "true");
        imageInput.attr("id", "image");
        imageInput.attr("name", "image");
        ttModal.find(".changeImageButton").replaceWith(imageInput);
    }

    // Code to handle the close state of ticket type modal
    ttModal.on("hide.bs.modal", function () {
        let ttForm = ttModal.find("#ticketTypeForm");
        ttForm.removeAttr("action");
        ttForm[0].reset();

        let ttModalLabel = ttModal.find("#ticketTypeModalLabel");
        ttModal.attr("aria-hidden", true);

        ttModalLabel.text("");
        resetCanvas();
    });

    // HELPER FUNCTIONS
    function drawCanvas() {
        // Clear canvas
        ttiContext.clearRect(0, 0, ttiCanvas.width, ttiCanvas.height);

        // Draw image
        ttiContext.drawImage(image, 0, 0, ttiCanvas.width, ttiCanvas.height);

        // Draw QR Code box
        ttiContext.strokeStyle = "red";
        ttiContext.lineWidth = 2;
        ttiContext.strokeRect(qrBox.left, qrBox.top, qrBox.width, qrBox.height);
    }

    function isInsideBox(x, y) {
        return x >= qrBox.left && x <= qrBox.left + qrBox.width && y >= qrBox.top && y <= qrBox.top + qrBox.height;
    }

    function getResizeCorner(x, y) {
        const corners = [
            { name: "top-left", x: qrBox.left, y: qrBox.top },
            { name: "top-right", x: qrBox.left + qrBox.width, y: qrBox.top },
            { name: "bottom-left", x: qrBox.left, y: qrBox.top + qrBox.height },
            { name: "bottom-right", x: qrBox.left + qrBox.width, y: qrBox.top + qrBox.height },
        ];
        return corners.find((corner) => Math.abs(corner.x - x) <= 8 && Math.abs(corner.y - y) <= 8);
    }

    function resetCanvas() {
        qrBox = { left: 50, top: 50, width: 100, height: 100 };
        ttiContext.clearRect(0, 0, ttiCanvas.width, ttiCanvas.height);
        image = new Image();
        showImageInputField();
    }

    // On Image Input
    // Event Listeners
    $("#ticketTypeForm").on("change", "#image", () => {
        resetCanvas();

        let fileInputTag = $("#ticketTypeForm #image");
        const file = fileInputTag.get(0).files[0];

        if (file) {
            image.src = URL.createObjectURL(file);
            currentImageBlob = file; // Save the file for sending later
            image.onload = () => {
                const maxCanvasWidth = 450;
                scale = Math.min(1, maxCanvasWidth / image.width);

                ttiCanvas.width = image.width * scale;
                ttiCanvas.height = image.height * scale;

                drawCanvas();
            };
        }
    });

    // Event Listeners of Canvas inside the Ticket Type Modal
    $("#canvas").on("mousedown", (e) => {
        const rect = ttiCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        activeResizeCorner = getResizeCorner(mouseX, mouseY);
        if (activeResizeCorner) {
            isResizing = true;
        } else if (isInsideBox(mouseX, mouseY)) {
            isDragging = true;
        }

        startX = mouseX;
        startY = mouseY;
    });

    $("#canvas").on("mousemove", (e) => {
        const rect = ttiCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isDragging) {
            const dx = mouseX - startX;
            const dy = mouseY - startY;
            qrBox.left = Math.max(0, Math.min(qrBox.left + dx, ttiCanvas.width - qrBox.width));
            qrBox.top = Math.max(0, Math.min(qrBox.top + dy, ttiCanvas.height - qrBox.height));
            startX = mouseX;
            startY = mouseY;
            drawCanvas();
        } else if (isResizing && activeResizeCorner) {
            const dx = mouseX - startX;
            const dy = mouseY - startY;

            if (activeResizeCorner.name === "top-left") {
                qrBox.left = Math.max(0, qrBox.left + dx);
                qrBox.top = Math.max(0, qrBox.top + dy);
                qrBox.width = Math.max(minBoxSize, qrBox.width - dx);
                qrBox.height = Math.max(minBoxSize, qrBox.height - dy);
            } else if (activeResizeCorner.name === "top-right") {
                qrBox.top = Math.max(0, qrBox.top + dy);
                qrBox.width = Math.max(minBoxSize, qrBox.width + dx);
                qrBox.height = Math.max(minBoxSize, qrBox.height - dy);
            } else if (activeResizeCorner.name === "bottom-left") {
                qrBox.left = Math.max(0, qrBox.left + dx);
                qrBox.width = Math.max(minBoxSize, qrBox.width - dx);
                qrBox.height = Math.max(minBoxSize, qrBox.height + dy);
            } else if (activeResizeCorner.name === "bottom-right") {
                qrBox.width = Math.max(minBoxSize, qrBox.width + dx);
                qrBox.height = Math.max(minBoxSize, qrBox.height + dy);
            }
            startX = mouseX;
            startY = mouseY;
            drawCanvas();
        }
    });

    $("#canvas").on("mouseup", () => {
        isDragging = false;
        isResizing = false;
        activeResizeCorner = null;
    });

    // Handle form submission
    formSubmitButton.on("click", async (e) => {
        const qrData = {
            x: Math.round(qrBox.left / scale),
            y: Math.round(qrBox.top / scale),
            width: Math.round(qrBox.width / scale),
            height: Math.round(qrBox.height / scale),
        };

        let name = $("#name").val();

        let formData = new FormData();
        formData.append("name", name);

        let fileInputTag = $("#ticketTypeForm #image");
        let file = fileInputTag.get(0)?.files[0];

        if (file) {
            formData.append("image", file);
        }

        formData.append("qrData", JSON.stringify(qrData));
        let url = $("#ticketTypeForm").attr("action");

        $.ajax({
            url,
            method: "POST",
            dataType: "json",
            contentType: false,
            processData: false,
            data: formData,
            success: function (data, text, xhr) {
                window.location.reload();
            },
            error: function (xhr, text) {
                let data = xhr.responseJSON;
                toastr.error(data.error);
            },
        });
    });
});
