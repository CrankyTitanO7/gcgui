export const CLEAR_ALL_EVENT = "gcgui:clear-all";

export function emitClearAll() {
    window.dispatchEvent(new CustomEvent(CLEAR_ALL_EVENT));
}
