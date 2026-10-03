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

// ---------------------------------------------------------------------------
// Linear best fit (ordinary least squares, y on x).
//
// x is the sample order 0..n-1, so the fit answers "how does this signal
// trend over the recording". Canonical keys/data are untouched — callers
// pass plain value arrays or accumulate into stats.
// ---------------------------------------------------------------------------

/**
 * Empty online sufficient statistics for a best-fit line.
 * Prefer this over buffering points: O(1) memory no matter how long
 * the recording runs. x is the insertion order (0, 1, 2, ...).
 * @returns {{ n: number, sx: number, sy: number, sxx: number, sxy: number, syy: number }}
 */
export function createFitStats() {
    return { n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0, syy: 0 };
}

/**
 * Fold one sample into fit statistics (mutates and returns `stats`).
 * Non-finite values are ignored (no x consumed, order stays contiguous).
 * @param {{ n: number, sx: number, sy: number, sxx: number, sxy: number, syy: number }} stats
 * @param {number} y
 */
export function addFitPoint(stats, y) {
    if (!stats || typeof y !== "number" || !Number.isFinite(y)) return stats;
    const x = stats.n;
    stats.n += 1;
    stats.sx += x;
    stats.sy += y;
    stats.sxx += x * x;
    stats.sxy += x * y;
    stats.syy += y * y;
    return stats;
}

/**
 * Solve the best-fit line from sufficient statistics.
 * @param {{ n: number, sx: number, sy: number, sxx: number, sxy: number, syy: number }} stats
 * @returns {{ slope: number, intercept: number, r: number|null, n: number }|null}
 *   null when fewer than 2 points. r is null for flat data (zero y
 *   variance — Pearson is undefined) and clamped to [-1, 1].
 */
export function fitFromStats(stats) {
    if (!stats || stats.n < 2) return null;
    const { n, sx, sy, sxx, sxy, syy } = stats;
    const denomX = n * sxx - sx * sx;
    if (!(denomX > 0)) return null;
    const slope = (n * sxy - sx * sy) / denomX;
    const intercept = (sy - slope * sx) / n;
    const denomY = n * syy - sy * sy;
    let r = null;
    if (denomY > 0) {
        r = (n * sxy - sx * sy) / Math.sqrt(denomX * denomY);
        if (r > 1) r = 1;
        else if (r < -1) r = -1;
    }
    return { slope, intercept, r, n };
}

/**
 * Best-fit line over values in order (x = 0..n-1).
 * Non-finite entries are skipped.
 * @param {number[]} values - oldest first
 * @returns {{ slope: number, intercept: number, r: number|null, n: number }|null}
 */
export function linearFit(values) {
    if (!Array.isArray(values)) return null;
    const stats = createFitStats();
    for (const v of values) {
        if (typeof v === "number" && Number.isFinite(v)) addFitPoint(stats, v);
    }
    return fitFromStats(stats);
}

/**
 * Format a fit as `y = mx + b` using compact tick numbers.
 */
export function formatFitEquation(fit) {
    if (!fit || typeof fit.slope !== "number" || typeof fit.intercept !== "number") return "—";
    if (!Number.isFinite(fit.slope) || !Number.isFinite(fit.intercept)) return "—";
    const m = formatTick(fit.slope);
    const bAbs = formatTick(Math.abs(fit.intercept));
    const sign = fit.intercept < 0 ? "-" : "+";
    return `y = ${m}x ${sign} ${bAbs}`;
}

/**
 * Format the Pearson coefficient as `r = 0.98` (`r = —` when undefined).
 */
export function formatFitR(fit) {
    if (!fit || typeof fit.r !== "number" || !Number.isFinite(fit.r)) return "r = —";
    return `r = ${fit.r.toFixed(2)}`;
}

export default {
    computeBounds,
    scalePoints,
    formatTick,
    createFitStats,
    addFitPoint,
    fitFromStats,
    linearFit,
    formatFitEquation,
    formatFitR,
};
