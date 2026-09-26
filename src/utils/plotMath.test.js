import { describe, expect, it } from "vitest";
import { computeBounds, formatTick, scalePoints } from "./plotMath";

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
