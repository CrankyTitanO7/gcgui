/**
 * Pure math helpers for the Line Plot widget.
 * DOM-free so they can be unit-tested.
 */

/**
 * Compute padded { min, max } bounds for a set of values.
 * Non-finite entries are ignored. Flat data is expanded so the line
 * renders centered instead of dividing by zero.
 * @param {number[]} values
 * @param {Object} opts - { padFraction } (default 0.1)
 * @returns {{ min: number, max: number }|null} null when no finite values
 */
export function computeBounds(values, { padFraction = 0.1 } = {}) {
    if (!Array.isArray(values)) return null;
    const nums = values.filter(v => typeof v === "number" && Number.isFinite(v));
    if (nums.length === 0) return null;

    let min = Math.min(...nums);
    let max = Math.max(...nums);

    if (min === max) {
        const delta = Math.abs(min) * 0.1 || 1;
        min -= delta;
        max += delta;
    } else {
        const pad = (max - min) * padFraction;
        min -= pad;
        max += pad;
    }

    return { min, max };
}

/**
 * Map values to pixel coordinates inside a width x height box.
 * Origin is top-left (SVG convention): larger values go up.
 * @param {number[]} values - Finite numbers, oldest first
 * @param {number} width - Inner plot width in px
 * @param {number} height - Inner plot height in px
 * @param {{ min: number, max: number }} bounds - From computeBounds
 * @returns {{ x: number, y: number }[]} Points in [0,width] x [0,height]
 */
export function scalePoints(values, width, height, bounds) {
    if (!Array.isArray(values) || values.length === 0) return [];
    if (!(width > 0) || !(height > 0)) return [];
    if (!bounds || !(bounds.max > bounds.min)) return [];

    const span = bounds.max - bounds.min;
    return values.map((v, i) => ({
        x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
        y: height - ((v - bounds.min) / span) * height,
    }));
}

/**
 * Format a tick value compactly: integers when large, up to 2 decimals
 * when small.
 * @param {number} value
 * @returns {string}
 */
export function formatTick(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 1000) return String(Math.round(value));
    if (abs >= 10) return String(Math.round(value * 10) / 10);
    if (abs >= 1) return String(Math.round(value * 100) / 100);
    return String(Math.round(value * 1000) / 1000);
}

export default {
    computeBounds,
    scalePoints,
    formatTick,
};
