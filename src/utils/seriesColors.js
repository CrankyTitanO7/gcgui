/**
 * Shared color palette for multi-line plotting.
 * DOM-free so it can be unit-tested. Colors are chosen to stay
 * distinguishable on the app's dark widget backgrounds.
 */

export const SERIES_COLORS = [
    "#4caf50",
    "#42a5f5",
    "#ffca28",
    "#ef5350",
    "#ab47bc",
    "#26c6da",
    "#ff7043",
    "#9ccc65",
    "#ec407a",
    "#8d9bff",
];

/**
 * Deterministic color for the Nth series (cycles when fields
 * outnumber palette entries).
 * @param {number} index - zero-based series position
 * @returns {string} hex color
 */
export function colorForSeriesIndex(index) {
    const i = Number.isInteger(index) && index >= 0 ? index : 0;
    return SERIES_COLORS[i % SERIES_COLORS.length];
}

export default {
    SERIES_COLORS,
    colorForSeriesIndex,
};
