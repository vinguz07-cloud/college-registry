import { items } from "./items.js";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyPqIcQzrghGa3yZt83mrIWCr2JyhHGRBfzwoYidt3v4pO1wrYOIQFcut1Za54ftZNj/exec";

const grid = document.querySelector("#grid");
const sortSelect = document.querySelector("#sort-items");
const cartCounter = document.querySelector("#cart-count");
const siteHeader = document.querySelector("#site-header");
const homeIntro = document.querySelector(".home-intro");
const gridViewButton = document.querySelector("#grid-view-btn");
const listViewButton = document.querySelector("#list-view-btn");
const registryStatus = document.querySelector("#registry-status");

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentView = localStorage.getItem("registry-view") || "grid";
let reservedItemIds = new Set();
let approvedReservations = new Map();

const formatPrice = price => `$${price}`;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

function updateCartCount() {
    cartCounter.textContent = cart.length;
}

function getSortedItems(sortType) {
    const sortedItems = [...items];
    if (sortType === "price-low") return sortedItems.sort((a, b) => a.price - b.price);
    if (sortType === "price-high") return sortedItems.sort((a, b) => b.price - a.price);
    if (sortType === "brand") {
        return sortedItems.sort((a, b) => a.store.localeCompare(b.store) || a.title.localeCompare(b.title));
    }
    return sortedItems;
}

function addToCart(item, button, unaddButton) {
    if (reservedItemIds.has(item.id) || cart.includes(item.id)) return;

    if (cart.length >= 3) {
        alert("You may only reserve up to 3 items.");
        return;
    }

    cart.push(item.id);
    saveCart();
    updateCartCount();
    button.textContent = "Added ✓";
    button.classList.add("added");
    button.disabled = true;
    unaddButton.hidden = false;
}

function removeFromCart(item, button, unaddButton) {
    cart = cart.filter(itemId => itemId !== item.id);
    saveCart();
    updateCartCount();
    button.textContent = reservedItemIds.has(item.id) ? "Reserved" : "Add to Cart";
    button.classList.toggle("reserved", reservedItemIds.has(item.id));
    button.classList.remove("added");
    button.disabled = reservedItemIds.has(item.id);
    unaddButton.hidden = true;
}

function createCard(item) {
    const card = document.createElement("article");
    const inCart = cart.includes(item.id);
    const isReserved = reservedItemIds.has(item.id);
    const approvedReservation = approvedReservations.get(item.id);
    const isApproved = Boolean(approvedReservation);
    const reservedBy = isApproved ? approvedReservation.reservedBy : "";
    const viewed = localStorage.getItem(`viewed_${item.id}`);

    card.className = [
        "card",
        viewed ? "interested" : "",
        isApproved ? "approved-reserved-card" : ""
    ].filter(Boolean).join(" ");

    card.innerHTML = `
        <img class="product-image" src="${item.image}" alt="${escapeHtml(item.title)}">
        <div class="info">
            <h2>${escapeHtml(item.title)}</h2>
            <div class="store">${escapeHtml(item.store)}</div>
            <div class="price">${formatPrice(item.price)}</div>
            <div class="reserved-by">${isApproved ? `Reserved by ${escapeHtml(reservedBy)}` : ""}</div>
            <div class="bottom-row">
                <div class="card-actions">
                    <button class="unadd-btn" type="button" ${inCart && !isReserved ? "" : "hidden"}>Unadd</button>
                    <button class="reserve-btn ${inCart ? "added" : ""} ${isReserved ? "reserved" : ""}" type="button" ${inCart || isReserved ? "disabled" : ""}>
                        ${isReserved ? "Reserved" : inCart ? "Added ✓" : "Add to Cart"}
                    </button>
                </div>
            </div>
        </div>
    `;

    const image = card.querySelector(".product-image");
    const button = card.querySelector(".reserve-btn");
    const unaddButton = card.querySelector(".unadd-btn");

    image.addEventListener("click", () => {
        localStorage.setItem(`viewed_${item.id}`, "true");
        card.classList.add("interested");
        window.open(item.link, "_blank", "noopener,noreferrer");
    });

    button.addEventListener("click", () => addToCart(item, button, unaddButton));
    unaddButton.addEventListener("click", () => removeFromCart(item, button, unaddButton));
    return card;
}

function renderItems(sortType = sortSelect.value || "default") {
    grid.innerHTML = "";
    getSortedItems(sortType).forEach(item => grid.append(createCard(item)));
    applyView(currentView);
}

function applyView(view) {
    currentView = view === "list" ? "list" : "grid";
    const isList = currentView === "list";
    grid.classList.toggle("list-view", isList);
    gridViewButton.classList.toggle("active", !isList);
    listViewButton.classList.toggle("active", isList);
    gridViewButton.setAttribute("aria-pressed", String(!isList));
    listViewButton.setAttribute("aria-pressed", String(isList));
    localStorage.setItem("registry-view", currentView);
}

function updateHeader() {
    const isDesktop = window.matchMedia("(min-width: 851px)").matches;
    const descriptionHasPassed = homeIntro.getBoundingClientRect().bottom <= 0;
    siteHeader.classList.toggle("scrolled", isDesktop && descriptionHasPassed);
    siteHeader.classList.toggle("has-shadow", descriptionHasPassed);
}

function loadReservedItems() {
    const callbackName = `registryReserved_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
        delete window[callbackName];
        script.remove();
    };

    window[callbackName] = result => {
        if (result?.ok) {
            reservedItemIds = new Set(result.itemIds || []);
            approvedReservations = new Map(
                (result.approvedItems || []).map(entry => [
                    entry.itemId,
                    { reservedBy: String(entry.reservedBy || "") }
                ])
            );
            cart = cart.filter(id => !reservedItemIds.has(id));
            saveCart();
            updateCartCount();
            registryStatus.textContent = "";
            renderItems();
        } else {
            registryStatus.textContent = result?.error || "Reservation availability could not be loaded.";
        }
        cleanup();
    };

    script.onerror = () => {
        registryStatus.textContent = "Reservation availability could not be loaded.";
        cleanup();
    };

    script.src = `${APPS_SCRIPT_URL}?page=reserved-items&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.head.append(script);
}

sortSelect.addEventListener("change", event => renderItems(event.target.value));
gridViewButton.addEventListener("click", () => applyView("grid"));
listViewButton.addEventListener("click", () => applyView("list"));
window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("resize", updateHeader);
window.addEventListener("focus", loadReservedItems);
setInterval(loadReservedItems, 30000);

updateCartCount();
renderItems();
updateHeader();
loadReservedItems();
