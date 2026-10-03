import { describe, expect, it } from "vitest";
import {
    addFitPoint,
    computeBounds,
    createFitStats,
    fitFromStats,
    formatFitEquation,
    formatFitR,
    formatTick,
    linearFit,
    scalePoints,
} from "./plotMath";

describe("computeBounds", () => {
    it("pads the data range by 10% on each side", () => {
        expect(computeBounds([0, 10])).toEqual({ min: -1, max: 11 });
    });

    it("expands flat data so the line stays centered", () => {
        const bounds = computeBounds([5, 5, 5]);
        expect(bounds.min).toBeLessThan(5);
        expect(bounds.max).toBeGreaterThan(5);
    });

    it("ignores non-finite values", () => {
        expect(computeBounds([NaN, 0, Infinity, 10])).toEqual({ min: -1, max: 11 });
    });

    it("returns null when there is nothing plottable", () => {
        expect(computeBounds([])).toBeNull();
        expect(computeBounds([NaN, Infinity])).toBeNull();
        expect(computeBounds(null)).toBeNull();
    });
});

describe("scalePoints", () => {
    it("maps values into the box with y flipped (SVG origin)", () => {
        const pts = scalePoints([0, 5, 10], 100, 50, { min: 0, max: 10 });
        expect(pts).toHaveLength(3);
        expect(pts[0]).toEqual({ x: 0, y: 50 });
        expect(pts[1]).toEqual({ x: 50, y: 25 });
        expect(pts[2]).toEqual({ x: 100, y: 0 });
    });

    it("centers a single point horizontally", () => {
        const pts = scalePoints([7], 100, 50, { min: 0, max: 10 });
        expect(pts).toEqual([{ x: 50, y: 15 }]);
    });

    it("returns [] for bad inputs", () => {
        expect(scalePoints([], 100, 50, { min: 0, max: 10 })).toEqual([]);
        expect(scalePoints([1], 0, 50, { min: 0, max: 10 })).toEqual([]);
        expect(scalePoints([1], 100, 50, { min: 5, max: 5 })).toEqual([]);
    });
});

describe("formatTick", () => {
    it("compacts large values to integers", () => {
        expect(formatTick(1234.56)).toBe("1235");
    });

    it("keeps decimals for small values", () => {
        expect(formatTick(12.345)).toBe("12.3");
        expect(formatTick(1.234)).toBe("1.23");
        expect(formatTick(0.1234)).toBe("0.123");
    });

    it("handles non-finite input", () => {
        expect(formatTick(NaN)).toBe("—");
        expect(formatTick(Infinity)).toBe("—");
    });
});

describe("linearFit", () => {
    it("recovers an exact line with r = 1", () => {
        const fit = linearFit([1, 3, 5, 7, 9]); // y = 2x + 1
        expect(fit.n).toBe(5);
        expect(fit.slope).toBeCloseTo(2, 9);
        expect(fit.intercept).toBeCloseTo(1, 9);
        expect(fit.r).toBeCloseTo(1, 9);
    });

    it("recovers a negative slope with r = -1", () => {
        const fit = linearFit([10, 7, 4, 1]); // y = -3x + 10
        expect(fit.slope).toBeCloseTo(-3, 9);
        expect(fit.intercept).toBeCloseTo(10, 9);
        expect(fit.r).toBeCloseTo(-1, 9);
    });

    it("returns slope 0 and null r for flat data", () => {
        const fit = linearFit([5, 5, 5, 5]);
        expect(fit.slope).toBeCloseTo(0, 9);
        expect(fit.intercept).toBeCloseTo(5, 9);
        expect(fit.r).toBeNull();
    });

    it("returns null with fewer than 2 points", () => {
        expect(linearFit([])).toBeNull();
        expect(linearFit([4])).toBeNull();
        expect(linearFit([NaN])).toBeNull();
        expect(linearFit(null)).toBeNull();
    });

    it("skips non-finite values", () => {
        const fit = linearFit([1, NaN, 3, Infinity, 5]);
        expect(fit.n).toBe(3);
        expect(fit.slope).toBeCloseTo(2, 9);
    });

    it("matches incremental stats accumulation", () => {
        const values = [2.5, 3.1, 4.7, 4.9, 7.2];
        const batch = linearFit(values);
        const stats = createFitStats();
        values.forEach(v => addFitPoint(stats, v));
        expect(fitFromStats(stats)).toEqual(batch);
    });
});

describe("formatFitEquation / formatFitR", () => {
    it("formats positive and negative intercepts", () => {
        expect(formatFitEquation({ slope: 2, intercept: 1 })).toBe("y = 2x + 1");
        expect(formatFitEquation({ slope: -0.5, intercept: -3.25 })).toBe("y = -0.5x - 3.25");
    });

    it("handles bad fits", () => {
        expect(formatFitEquation(null)).toBe("—");
        expect(formatFitR(null)).toBe("r = —");
        expect(formatFitR({ r: null })).toBe("r = —");
    });

    it("formats r to two decimals", () => {
        expect(formatFitR({ r: 0.98234 })).toBe("r = 0.98");
        expect(formatFitR({ r: -1 })).toBe("r = -1.00");
    });
});
