import { items } from "./items.js";
const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyPqIcQzrghGa3yZt83mrIWCr2JyhHGRBfzwoYidt3v4pO1wrYOIQFcut1Za54ftZNj/exec";

const cartContainer =
    document.querySelector("#cart-items");

const subtotalElement =
    document.querySelector("#subtotal");

const itemCountElement =
    document.querySelector("#item-count");

const cartCounter =
    document.querySelector("#cart-count");

const reservationForm =
    document.querySelector("#reservation-form");

const reserveButton =
    document.querySelector("#reserve-all");

const reservationStatus =
    document.querySelector("#reservation-status");

const nameInput =
    document.querySelector("#reservation-name");

const emailInput =
    document.querySelector("#reservation-email");

let cart =
    JSON.parse(localStorage.getItem("cart")) || [];

let reservedItemIds = new Set();
let reservationInProgress = false;

const formatPrice = price => `$${price}`;

function saveCart() {
    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );
}

function setStatus(message, type = "") {
    if (!reservationStatus) {
        return;
    }

    reservationStatus.textContent = message;
    reservationStatus.className =
        `reservation-status ${type}`.trim();
}

function removeItem(id) {
    if (reservationInProgress) {
        return;
    }

    cart = cart.filter(
        itemId => itemId !== id
    );

    saveCart();
    updatePage();
}

function getCartItems() {
    return cart
        .map(id =>
            items.find(item => item.id === id)
        )
        .filter(Boolean);
}

function updatePage() {
    if (!cartContainer) {
        return;
    }

    const cartItems = getCartItems();

    cartContainer.innerHTML = "";

    if (!cartItems.length) {
        cartContainer.innerHTML = `
            <div class="cart-item">
                <div class="cart-info">
                    <h2>Your cart is empty.</h2>
                    <p>
                        Browse the registry to add gifts.
                    </p>
                </div>
            </div>
        `;
    }

    cartItems.forEach(item => {
        const element =
            document.createElement("div");

        const isReserved =
            reservedItemIds.has(item.id);

        element.className =
            `cart-item${isReserved ? " unavailable" : ""}`;

        element.innerHTML = `
            <img
                src="${item.image}"
                alt="${item.title}"
            >

            <div class="cart-info">
                <h2>${item.title}</h2>
                <p>${item.store}</p>

                <strong>
                    ${formatPrice(item.price)}
                </strong>

                ${
                    isReserved
                        ? `
                            <p class="reserved-note">
                                Reserved
                            </p>
                        `
                        : ""
                }
            </div>

            <button
                class="remove-btn"
                type="button"
                ${
                    reservationInProgress
                        ? "disabled"
                        : ""
                }
            >
                Remove
            </button>
        `;

        element
            .querySelector(".remove-btn")
            .addEventListener(
                "click",
                () => removeItem(item.id)
            );

        cartContainer.append(element);
    });

    const subtotal = cartItems.reduce(
        (total, item) => total + item.price,
        0
    );

    const hasUnavailableItem =
        cartItems.some(item =>
            reservedItemIds.has(item.id)
        );

    if (subtotalElement) {
        subtotalElement.textContent =
            formatPrice(subtotal);
    }

    if (itemCountElement) {
        itemCountElement.textContent =
            `${cartItems.length} / 3`;
    }

    if (cartCounter) {
        cartCounter.textContent =
            cartItems.length;
    }

    if (reserveButton) {
        reserveButton.disabled =
            reservationInProgress ||
            !cartItems.length ||
            hasUnavailableItem;

        reserveButton.textContent =
            reservationInProgress
                ? "Reserving..."
                : "Reserve These Gifts";
    }

    if (hasUnavailableItem) {
        setStatus(
            "One or more selected gifts have already been reserved. Remove them before continuing.",
            "error"
        );
    }
}

function createRequestId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
}

function createReservationId() {
    const randomPart = crypto.randomUUID
        ? crypto.randomUUID().replaceAll("-", "")
        : `${Date.now()}${Math.random()
            .toString(36)
            .slice(2)}`;

    return `VCR-${randomPart
        .slice(0, 20)
        .toUpperCase()}`;
}

function submitReservationToAppsScript({
    name,
    email,
    itemIds
}) {
    return new Promise((resolve, reject) => {
        const requestId = createRequestId();
        const reservationId = createReservationId();
        const iframeName =
            `reservation-response-${requestId}`;

        const iframe =
            document.createElement("iframe");

        const form =
            document.createElement("form");

        let finished = false;
        let pollTimer = null;
        let pollScript = null;

        iframe.name = iframeName;
        iframe.hidden = true;

        form.method = "POST";
        form.action = APPS_SCRIPT_URL;
        form.target = iframeName;
        form.hidden = true;

        const fields = {
            action: "createReservation",
            requestId,
            reservationId,
            name,
            email,
            itemIds: JSON.stringify(itemIds),
            website: ""
        };

        Object.entries(fields).forEach(
            ([fieldName, value]) => {
                const input =
                    document.createElement("input");

                input.type = "hidden";
                input.name = fieldName;
                input.value = value;

                form.append(input);
            }
        );

        const callbackName =
            `registryStatus${requestId.replace(/[^A-Za-z0-9_$]/g, "")}`;

        const removePollScript = () => {
            pollScript?.remove();
            pollScript = null;
        };

        const cleanup = () => {
            window.removeEventListener(
                "message",
                handleMessage
            );

            clearInterval(pollTimer);
            removePollScript();
            delete window[callbackName];
            iframe.remove();
            form.remove();
        };

        const finish = callback => {
            if (finished) {
                return;
            }

            finished = true;
            clearTimeout(timeout);
            cleanup();
            callback();
        };

        const handleSuccess = response => {
            finish(() => resolve({
                ok: true,
                reservationId:
                    response.reservationId || reservationId,
                uploadUrl: response.uploadUrl || ""
            }));
        };

        const handleMessage = event => {
            const response = event.data;

            if (
                !response ||
                response.source !==
                    "college-registry-backend" ||
                response.requestId !== requestId
            ) {
                return;
            }

            if (response.ok) {
                handleSuccess(response);
            } else {
                finish(() => {
                    reject(
                        new Error(
                            response.error ||
                            "The reservation could not be completed."
                        )
                    );
                });
            }
        };

        window[callbackName] = response => {
            removePollScript();

            if (response?.found) {
                handleSuccess(response);
            }
        };

        const pollStatus = () => {
            if (finished || pollScript) {
                return;
            }

            pollScript = document.createElement("script");
            pollScript.src =
                `${APPS_SCRIPT_URL}` +
                `?page=status` +
                `&reservationId=${encodeURIComponent(reservationId)}` +
                `&callback=${encodeURIComponent(callbackName)}` +
                `&_=${Date.now()}`;

            pollScript.onerror = removePollScript;
            document.body.append(pollScript);
        };

        const timeout = setTimeout(() => {
            finish(() => {
                reject(
                    new Error(
                        "The reservation request timed out. Please check your email before trying again."
                    )
                );
            });
        }, 90000);

        window.addEventListener(
            "message",
            handleMessage
        );

        document.body.append(iframe, form);
        form.submit();

        setTimeout(pollStatus, 1500);
        pollTimer = setInterval(pollStatus, 2000);
    });
}

async function reserveItems(event) {
    event.preventDefault();

    if (
        reservationInProgress ||
        !reservationForm?.reportValidity()
    ) {
        return;
    }

    const cartItems = getCartItems();

    if (!cartItems.length) {
        setStatus(
            "Your cart is empty.",
            "error"
        );

        return;
    }

    const unavailableItem =
        cartItems.find(item =>
            reservedItemIds.has(item.id)
        );

    if (unavailableItem) {
        setStatus(
            `${unavailableItem.title} has already been reserved.`,
            "error"
        );

        updatePage();
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    reservationInProgress = true;
    setStatus("");
    updatePage();

    try {
        const response =
            await submitReservationToAppsScript({
                name,
                email,
                itemIds: cartItems.map(
                    item => item.id
                )
            });

        cart = [];
        saveCart();

        reservationForm.reset();

        reservedItemIds = new Set([
            ...reservedItemIds,
            ...cartItems.map(item => item.id)
        ]);

        setStatus(
            "Your gifts have been reserved.",
            "success"
        );

        updatePage();
        loadReservedItems();
    } catch (error) {
        console.error(error);

        setStatus(
            error.message ||
                "The reservation could not be completed. Please try again.",
            "error"
        );
    } finally {
        reservationInProgress = false;
        updatePage();
    }
}

function loadReservedItems() {
    const callbackName =
        `registryReserved_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`;

    const script = document.createElement("script");

    const cleanup = () => {
        delete window[callbackName];
        script.remove();
    };

    window[callbackName] = result => {
        if (result?.ok) {
            reservedItemIds = new Set(
                result.itemIds || []
            );

            updatePage();
        } else {
            setStatus(
                result?.error ||
                    "Reservation availability could not be loaded.",
                "error"
            );
        }

        cleanup();
    };

    script.onerror = () => {
        setStatus(
            "Reservation availability could not be loaded.",
            "error"
        );

        cleanup();
    };

    script.src =
        `${APPS_SCRIPT_URL}` +
        `?page=reserved-items` +
        `&callback=${encodeURIComponent(callbackName)}` +
        `&_=${Date.now()}`;

    document.head.append(script);
}

reservationForm?.addEventListener(
    "submit",
    reserveItems
);

window.addEventListener("focus", loadReservedItems);
setInterval(loadReservedItems, 30000);

updatePage();
loadReservedItems();
