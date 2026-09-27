import { describe, expect, it } from "vitest";
import {
    downsampleSeries,
    getCsvFieldValue,
    getHistoryFieldNames,
    getHistoryFieldValue,
    getHistorySeries,
} from "./logHistory";

describe("getCsvFieldValue", () => {
    it("maps datapoint N to the Nth cell after time", () => {
        expect(getCsvFieldValue("12.345, 512, 23.7", "datapoint 1")).toBe(512);
        expect(getCsvFieldValue("12.345, 512, 23.7", "datapoint 2")).toBe(23.7);
    });

    it("returns null for time, unknown fields, and non-numeric cells", () => {
        expect(getCsvFieldValue("12.345, 512, 23.7", "time")).toBeNull();
        expect(getCsvFieldValue("12.345, 512, 23.7", "datapoint 3")).toBeNull();
        expect(getCsvFieldValue("12.345, abc, 23.7", "datapoint 1")).toBeNull();
        expect(getCsvFieldValue("not csv", "datapoint 1")).toBeNull();
    });
});

describe("getHistoryFieldValue", () => {
    it("decodes CAN fields with scaling", () => {
        // 0x61 HighCellVoltage: uint16 bytes [0,1], scale 0.0001
        const message = { kind: "can", timestamp: 1, canId: "0x61", dataBytes: [0x10, 0x00, 0, 0, 0, 0, 0, 0] };
        expect(getHistoryFieldValue(message, "HighCellVoltage")).toBeCloseTo(0.4096, 4);
    });

    it("returns null for unknown CAN ids and time", () => {
        const message = { kind: "can", timestamp: 1, canId: "0xdead", dataBytes: [1, 2] };
        expect(getHistoryFieldValue(message, "Anything")).toBeNull();
        expect(getHistoryFieldValue({ kind: "csv", timestamp: 0, raw: "1, 2" }, "time")).toBeNull();
    });
});

describe("getHistoryFieldNames", () => {
    it("collects CSV datapoints with numeric values in first-seen order", () => {
        const messages = [
            { kind: "csv", timestamp: 0, raw: "0, 1, 2" },
            { kind: "csv", timestamp: 0.1, raw: "0.1, 3, abc" },
        ];
        expect(getHistoryFieldNames(messages)).toEqual(["datapoint 1", "datapoint 2"]);
    });

    it("collects decodable CAN fields and skips unknown ids", () => {
        const messages = [
            { kind: "can", timestamp: 0, canId: "0x61", dataBytes: [0x10, 0x00, 0, 0, 0, 0, 0, 0] },
            { kind: "can", timestamp: 1, canId: "0xdead", dataBytes: [1, 2] },
        ];
        const names = getHistoryFieldNames(messages);
        expect(names).toContain("HighCellVoltage");
        expect(names).not.toContain("time");
    });

    it("returns [] for empty input", () => {
        expect(getHistoryFieldNames([])).toEqual([]);
        expect(getHistoryFieldNames(null)).toEqual([]);
    });
});

describe("getHistorySeries", () => {
    it("preserves original message indices for playhead alignment", () => {
        const messages = [
            { kind: "csv", timestamp: 0, raw: "0, 10, x" },
            { kind: "csv", timestamp: 0.1, raw: "0.1, bad, 5" },
            { kind: "csv", timestamp: 0.2, raw: "0.2, 30, 6" },
        ];
        expect(getHistorySeries(messages, "datapoint 1")).toEqual([
            { index: 0, timestamp: 0, value: 10 },
            { index: 2, timestamp: 0.2, value: 30 },
        ]);
    });
});

describe("downsampleSeries", () => {
    it("keeps short series untouched and caps long ones", () => {
        const short = [1, 2, 3].map((value, index) => ({ index, timestamp: index, value }));
        expect(downsampleSeries(short, 2000)).toBe(short);

        const long = Array.from({ length: 5000 }, (_, index) => ({ index, timestamp: index, value: index }));
        const out = downsampleSeries(long, 2000);
        expect(out.length).toBeLessThanOrEqual(2001);
        expect(out[out.length - 1]).toEqual(long[long.length - 1]);
    });
});
