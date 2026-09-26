import { describe, expect, it } from "vitest";
import { parseCSVLog, parseCSVLogLine } from "./csvLogParser";

describe("parseCSVLogLine", () => {
    it("parses a data row with the first column as timestamp", () => {
        expect(parseCSVLogLine("12.345, 512, 23.7")).toEqual({
            kind: "csv",
            timestamp: 12.345,
            raw: "12.345, 512, 23.7",
        });
    });

    it("falls back to the given timestamp without a numeric first column", () => {
        expect(parseCSVLogLine("abc, 1, 2", 0.4)).toMatchObject({ timestamp: 0.4 });
    });

    it("rejects non-CSV lines", () => {
        expect(parseCSVLogLine("no commas here")).toBeNull();
        expect(parseCSVLogLine("")).toBeNull();
        expect(parseCSVLogLine("single")).toBeNull();
    });

    it("keeps rows with an empty trailing cell", () => {
        expect(parseCSVLogLine("only,", 1.5)).toMatchObject({ kind: "csv", timestamp: 1.5, raw: "only," });
    });
});

describe("parseCSVLog", () => {
    it("parses a live-capture file, skipping header and stray lines", () => {
        const content = [
            "# gcgui csv live capture 2026-09-26T00:00:00.000Z",
            "12.345, 512, 23.7",
            "booting up",
            "",
            "12.545, 508, 23.8",
        ].join("\n");
        const { header, messages } = parseCSVLog(content);
        expect(header).toMatchObject({ raw: expect.stringContaining("# gcgui csv live capture") });
        expect(messages).toHaveLength(2);
        expect(messages[0]).toMatchObject({ kind: "csv", timestamp: 12.345 });
        expect(messages[1]).toMatchObject({ kind: "csv", timestamp: 12.545 });
    });

    it("spaces rows without numeric timestamps 100ms apart", () => {
        const { messages } = parseCSVLog("a, 1\nb, 2\n");
        expect(messages.map(m => m.timestamp)).toEqual([0, 0.1]);
    });

    it("returns no messages for header-only content", () => {
        expect(parseCSVLog("# gcgui csv live capture x\n").messages).toEqual([]);
    });
});
