import { describe, expect, it } from "vitest";
import { describePayload, formatSendPayload, isEditableTarget, keyToSendPayload, shouldCaptureKey } from "./serialSend";

describe("formatSendPayload", () => {
    it("appends a newline by default", () => {
        expect(formatSendPayload("hello")).toBe("hello\n");
    });

    it("does not double-append a newline", () => {
        expect(formatSendPayload("hello\n")).toBe("hello\n");
    });

    it("sends verbatim when appendNewline is false", () => {
        expect(formatSendPayload("hello", { appendNewline: false })).toBe("hello");
    });

    it("returns empty string for blank input", () => {
        expect(formatSendPayload("")).toBe("");
        expect(formatSendPayload(undefined)).toBe("");
    });
});

describe("keyToSendPayload", () => {
    it("passes printable characters through verbatim", () => {
        expect(keyToSendPayload("a")).toBe("a");
        expect(keyToSendPayload(" ")).toBe(" ");
        expect(keyToSendPayload("5")).toBe("5");
    });

    it("maps Enter to newline", () => {
        expect(keyToSendPayload("Enter")).toBe("\n");
    });

    it("ignores special keys", () => {
        expect(keyToSendPayload("Shift")).toBeNull();
        expect(keyToSendPayload("ArrowUp")).toBeNull();
        expect(keyToSendPayload("F1")).toBeNull();
        expect(keyToSendPayload("Escape")).toBeNull();
        expect(keyToSendPayload("")).toBeNull();
    });
});

describe("shouldCaptureKey", () => {
    it("captures plain character keys", () => {
        expect(shouldCaptureKey({ key: "a", target: { tagName: "DIV" } })).toBe(true);
        expect(shouldCaptureKey({ key: "Enter", target: { tagName: "BODY" } })).toBe(true);
    });

    it("never captures Escape", () => {
        expect(shouldCaptureKey({ key: "Escape", target: { tagName: "BODY" } })).toBe(false);
    });

    it("never captures while typing in editable elements", () => {
        expect(shouldCaptureKey({ key: "a", target: { tagName: "INPUT" } })).toBe(false);
        expect(shouldCaptureKey({ key: "a", target: { tagName: "TEXTAREA" } })).toBe(false);
        expect(shouldCaptureKey({ key: "Enter", target: { tagName: "TEXTAREA" } })).toBe(false);
    });

    it("never captures key combos with modifiers", () => {
        expect(shouldCaptureKey({ key: "a", ctrlKey: true, target: { tagName: "BODY" } })).toBe(false);
        expect(shouldCaptureKey({ key: "r", metaKey: true, target: { tagName: "BODY" } })).toBe(false);
    });

    it("skips non-sendable keys", () => {
        expect(shouldCaptureKey({ key: "ArrowUp", target: { tagName: "BODY" } })).toBe(false);
    });
});

describe("isEditableTarget", () => {
    it("detects inputs, textareas and selects", () => {
        expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
        expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
        expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
    });

    it("detects contentEditable elements", () => {
        expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    });

    it("returns false for plain elements and junk", () => {
        expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
        expect(isEditableTarget(null)).toBe(false);
        expect(isEditableTarget(undefined)).toBe(false);
    });
});

describe("describePayload", () => {
    it("labels control characters readably", () => {
        expect(describePayload("\n")).toBe("Enter ⏎");
        expect(describePayload(" ")).toBe("Space");
    });

    it("passes normal text through", () => {
        expect(describePayload("x")).toBe("x");
    });
});
