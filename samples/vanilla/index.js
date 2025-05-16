// In vanilla JS, the `@digitalpersona/iwa` and `@digitalpersona/websdk` are
// imported using the `<script>` tag, and the `IWA` and `WebSdk` objects are
// available as global variables. Typings are available via the `<reference>`
// triple-slash directive (https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html)

/// <reference types="@digitalpersona/websdk" />
/// <reference types="@digitalpersona/iwa" />

// Little HTML helper
const $ = (selector, root) => typeof selector === "string" ?
    (root ?? document).querySelector(selector) :
    selector;

// HTML elements
const signinButton = $("#signin");

const api = new IWA.WebApi({
    debug: true,
});
api.onCommunicationFailed = onCommunicationFailed.bind(this);


signinButton.onclick = signin.bind(this);

// API event handlers and status updates

async function onCommunicationFailed(event) {
    handleError(event.error);
}

async function onErrorOccurred(event) {
    handleError(event.error);
}

// Capture control methods and status updates

async function signin() {
    try {
        const jwt = await api.authenticate("https://localhost/DPWebAUTH/DPWebAuthService.svc");
        await addItem("#tokens", {
            jwt,
            time: new Date().toLocaleString(),
        });
    } catch (error) {
        handleError(error);
    }
}

// Other status methods

function handleError(error) {
    $("#error").innerHTML = error?.message || error?.type || "";
}

// HTML view helpers

async function showDialog(id, defaultValue = {}) {
    return new Promise((resolve) => {
        const dialog = $(id);
        const form = $("*", dialog);
        form.reset();

        dialog.onclose = () => {
            const data = Object.fromEntries(new FormData(form).entries());
            resolve(dialog.returnValue === "ok" ? data : defaultValue);
        }
        dialog.showModal();
    });
}

// Data conversion functions

function hex(str) {
    return Array.from(str)
    .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

// Data transfer functions

const isControl = el => ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
const isMedia = el => ["IMG", "AUDIO", "VIDEO"].includes(el.tagName);

// Set data to HTML elements, using the `name` attribute as a JSON path
function setData(element, data) {
    for (let child of element.children) {
        if (child.hasAttribute('name')) {
            const jsonPath = child.getAttribute('name');
            let value = jsonPath.split('.').reduce((o, k) => (o || {})[k], data);
            if (typeof value === "object") value = JSON.stringify(value, null, 2);
            if (isControl(child)) {
                child.value = value;
            } else if (isMedia(child)) {
                child.src = value;
            } else {
                child.innerText = value;
            }
        }
        setData(child, data);
    }
}

// Item list functions

// Add an item to the list, using the `item-template` attribute as a template reference
// and the `name` attribute as a JSON path to set data
function addItem(list, itemData, afterInsert) {
    const container = $(list);
    const itemTemplate = $(container.getAttribute("item-template"));
    const node = itemTemplate.content.cloneNode(true);
    setData(node, itemData);
    container.insertBefore(node, container.firstChild);
    afterInsert ? afterInsert(container.firstElementChild) : void(0);
}

function clearItems(list) {
    const container = $(list);
    container.textContent = "";
}
