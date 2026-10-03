/**
 * CSV datapoint aliases.
 *
 * Live CSV lines are `time, v1, v2, ...` and the parser names columns
 * "time", "datapoint 1", "datapoint 2", ... The canonical keys never change
 * (parsing, history, replay all use them); aliases only affect display.
 *
 * aliases shape: { [canonical]: string }, e.g. { "datapoint 1": "Temp" }
 * Empty / whitespace-only alias means "use the canonical name".
 * New datapoints are picked up automatically — any "datapoint N" key works.
 */

export function isDatapointField(field) {
    return typeof field === "string" && /^datapoint \d+$/.test(field);
}

export function normalizeAlias(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

export function getCsvDisplayName(field, aliases) {
    if (!field || typeof field !== "string") return field;
    const alias = aliases?.[field];
    const clean = normalizeAlias(alias ?? "");
    return clean || field;
}

/**
 * Map a display name (or canonical name) back to its canonical key.
 * Selects use canonical values so this is mainly for free-text entry
 * (e.g. widget properties editor) and for hardening initial state.
 */
export function resolveCsvCanonical(input, aliases) {
    if (!input || typeof input !== "string") return input;
    const trimmed = input.trim();
    if (!trimmed) return input;
    // Already canonical.
    if (isDatapointField(trimmed)) return trimmed;
    if (!aliases || typeof aliases !== "object") return input;
    for (const [key, value] of Object.entries(aliases)) {
        if (!isDatapointField(key)) continue;
        const alias = normalizeAlias(value ?? "");
        if (!alias) continue;
        if (trimmed === alias) return key;
        // Case-insensitive fallback so "Temp" matches "temp".
        if (trimmed.toLowerCase() === alias.toLowerCase()) return key;
    }
    return input;
}

export function sanitizeCsvAliases(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!isDatapointField(key)) continue;
        if (typeof value !== "string") continue;
        const clean = value.slice(0, 40);
        // Keep empty strings too so clearing a name persists as default.
        out[key] = clean;
    }
    return out;
}

const STORAGE_KEY = "gcgui.csvAliases";

export function loadCsvAliases() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return sanitizeCsvAliases(JSON.parse(raw));
    } catch {
        return {};
    }
}

export function saveCsvAliases(aliases) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeCsvAliases(aliases)));
    } catch {
        // storage unavailable (private mode, etc.) — aliases still work in-memory
    }
}

export default {
    isDatapointField,
    normalizeAlias,
    getCsvDisplayName,
    resolveCsvCanonical,
    sanitizeCsvAliases,
    loadCsvAliases,
    saveCsvAliases,
};
