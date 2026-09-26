/**
 * Helpers for the Send / Key-Send widgets.
 *
 * Pure functions only (no DOM, no Electron) so they can be unit-tested.
 * The widgets and the App shortcut guard build on top of these.
 */

// ---------------------------------------------------------------------------
// Editable-target detection (typing into these must never trigger a send)
// ---------------------------------------------------------------------------

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target) {
    if (!target || typeof target !== "object") return false;
    if (target.isContentEditable) return true;
    // Guarded for non-DOM environments (unit tests).
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
        return EDITABLE_TAGS.has(target.tagName);
    }
    // Plain-object shape used in tests: { tagName: "INPUT" }.
    return typeof target.tagName === "string" && EDITABLE_TAGS.has(target.tagName.toUpperCase());
}

// ---------------------------------------------------------------------------
// Raw message formatting (Send widget)
// ---------------------------------------------------------------------------

/**
 * Build the exact bytes to write for a raw message.
 * @param {string} text - Message as typed by the user
 * @param {Object} opts - { appendNewline: boolean } (default true)
 * @returns {string} Payload to write, or "" when there is nothing to send
 */
export function formatSendPayload(text, { appendNewline = true } = {}) {
    if (typeof text !== "string") return "";
    if (text.length === 0) return "";
    if (appendNewline && !text.endsWith("\n")) {
        return text + "\n";
    }
    return text;
}

// ---------------------------------------------------------------------------
// Keyboard capture mapping (Key-Send widget)
// ---------------------------------------------------------------------------

/**
 * Map a KeyboardEvent.key value to the bytes to send.
 * Single printable characters are sent verbatim, Enter sends "\n",
 * everything else (modifiers, arrows, F-keys, ...) is ignored (null).
 * @param {string} key - event.key value
 * @returns {string|null} Payload to write, or null to skip
 */
export function keyToSendPayload(key) {
    if (typeof key !== "string" || key.length === 0) return null;
    if (key === "Enter") return "\n";
    if (key.length === 1) return key;
    return null;
}

/**
 * Decide whether a keydown event should be captured for sending.
 * Never captures while typing in an editable element, and never captures
 * Escape (it stays app-level: closes panels/menus).
 * @param {Object} event - Keydown event (or { key, target } shape)
 * @returns {boolean}
 */
export function shouldCaptureKey(event) {
    if (!event || typeof event.key !== "string") return false;
    if (event.key === "Escape") return false;
    if (event.target && isEditableTarget(event.target)) return false;
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    return keyToSendPayload(event.key) !== null;
}

/**
 * Human-readable label for a sent payload (for the "last sent" readout).
 * @param {string} payload
 * @returns {string}
 */
export function describePayload(payload) {
    if (payload === "\n") return "Enter ⏎";
    if (payload === " ") return "Space";
    if (payload === "\t") return "Tab";
    return payload;
}

export default {
    isEditableTarget,
    formatSendPayload,
    keyToSendPayload,
    shouldCaptureKey,
    describePayload,
};
