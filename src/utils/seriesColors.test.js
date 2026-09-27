import { describe, expect, it } from "vitest";
import { SERIES_COLORS, colorForSeriesIndex } from "./seriesColors";

describe("colorForSeriesIndex", () => {
    it("returns palette entries in order", () => {
        expect(colorForSeriesIndex(0)).toBe(SERIES_COLORS[0]);
        expect(colorForSeriesIndex(1)).toBe(SERIES_COLORS[1]);
    });

    it("cycles when the index exceeds the palette", () => {
        expect(colorForSeriesIndex(SERIES_COLORS.length)).toBe(SERIES_COLORS[0]);
        expect(colorForSeriesIndex(SERIES_COLORS.length + 1)).toBe(SERIES_COLORS[1]);
    });

    it("falls back to the first color for bad input", () => {
        expect(colorForSeriesIndex(-1)).toBe(SERIES_COLORS[0]);
        expect(colorForSeriesIndex(NaN)).toBe(SERIES_COLORS[0]);
    });
});
