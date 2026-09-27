import { CAN_MESSAGE_TYPES, decodeCanFieldValue } from "../components/parsers/canproc";

/**
 * Helpers for the replay full-history graph.
 * DOM-free so they can be unit-tested.
 *
 * Log messages come in two shapes (see App.jsx log parsing):
 *   CAN: { kind: "can", timestamp, canId: "0x...", dataBytes: [...] }
 *   CSV: { kind: "csv", timestamp, raw: "time, v1, v2, ..." }
 */

// "time" is the sample clock, not a plottable signal.
export const isPlottableHistoryField = name => name !== "time";

const toFiniteNumber = cell => {
    if (cell === "" || cell == null) return null;
    const num = Number(cell);
    return Number.isFinite(num) ? num : null;
};

/**
 * Extract a numeric CSV field from a raw log line.
 * Cells map to "time", "datapoint 1", "datapoint 2", ...
 * @param {string} raw - e.g. "12.345, 512, 23.7"
 * @param {string} field - e.g. "datapoint 1"
 * @returns {number|null}
 */
export function getCsvFieldValue(raw, field) {
    if (typeof raw !== "string" || !field || field === "time") return null;
    const match = /^datapoint (\d+)$/.exec(field);
    if (!match) return null;
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1) return null;
    const cells = raw.split(",").map(c => c.trim());
    // cells[0] is time, so datapoint N lives at index N
    if (n >= cells.length) return null;
    return toFiniteNumber(cells[n]);
}

/**
 * Extract a numeric field value from any log message.
 * @param {Object} message - replay message
 * @param {string} field
 * @returns {number|null}
 */
export function getHistoryFieldValue(message, field) {
    if (!message || !field || !isPlottableHistoryField(field)) return null;
    if (message.kind === "csv" || !message.dataBytes) {
        return getCsvFieldValue(message.raw, field);
    }
    return decodeCanFieldValue(message, field);
}

/**
 * Union of plottable field names that carry at least one numeric
 * value across the whole file, in first-seen order.
 * @param {Object[]} messages
 * @returns {string[]}
 */
export function getHistoryFieldNames(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return [];
    const names = [];
    const seen = new Set();
    const add = name => {
        if (!isPlottableHistoryField(name) || seen.has(name)) return;
        seen.add(name);
        names.push(name);
    };

    for (const message of messages) {
        if (!message) continue;
        if (message.kind === "csv" || !message.dataBytes) {
            if (typeof message.raw !== "string" || !message.raw.includes(",")) continue;
            const cells = message.raw.split(",").map(c => c.trim());
            for (let i = 1; i < cells.length; i++) {
                if (toFiniteNumber(cells[i]) !== null) add(`datapoint ${i}`);
            }
        } else {
            const config = CAN_MESSAGE_TYPES[message.canId];
            if (!config) continue;
            for (const field of config.fields ?? []) {
                if (decodeCanFieldValue(message, field) !== null) add(field);
            }
        }
    }
    return names;
}

/**
 * Full-file series for one field, preserving original message indices
 * so the playhead and click-to-seek stay aligned with the file.
 * @param {Object[]} messages
 * @param {string} field
 * @returns {{ index: number, timestamp: number, value: number }[]}
 */
export function getHistorySeries(messages, field) {
    if (!Array.isArray(messages) || !field) return [];
    const series = [];
    for (let index = 0; index < messages.length; index++) {
        const message = messages[index];
        const value = getHistoryFieldValue(message, field);
        if (value !== null) {
            series.push({ index, timestamp: message?.timestamp ?? index, value });
        }
    }
    return series;
}

/**
 * Stride-sample a series for rendering so huge files stay fast.
 * Always keeps the last point.
 * @param {Object[]} series
 * @param {number} maxPoints
 */
export function downsampleSeries(series, maxPoints = 2000) {
    if (!Array.isArray(series) || series.length <= maxPoints || maxPoints < 2) return series ?? [];
    const stride = Math.ceil(series.length / maxPoints);
    const out = series.filter((_, i) => i % stride === 0);
    const last = series[series.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    return out;
}

export default {
    getCsvFieldValue,
    getHistoryFieldValue,
    getHistoryFieldNames,
    getHistorySeries,
    downsampleSeries,
    isPlottableHistoryField,
};
