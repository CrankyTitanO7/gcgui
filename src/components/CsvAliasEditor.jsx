import { useEffect, useRef, useState } from "react";

/**
 * Popup editor for CSV datapoint display names.
 * Renders one text field per detected datapoint (canonical key), so new
 * columns appear automatically as soon as they are detected.
 * Aliases are display-only; data lookup keeps using canonical keys.
 */
export default function CsvAliasEditor({ fields = [], aliases = {}, onAliasChange }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = e => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = e => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("mousedown", onPointerDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open ]);

    return (
        <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
            <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                    e.stopPropagation();
                    setOpen(v => !v);
                }}
                title="Rename CSV fields (display names only)"
                style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: open ? "#243056" : "#171c3d",
                    color: "#d7d9e5",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                {open ? "Names ✓" : "✎ Names"}
            </button>

            {open && (
                <div
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 50,
                        width: 250,
                        maxHeight: 220,
                        overflowY: "auto",
                        background: "#0d1230",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                    }}
                >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#eef2ff" }}>Rename fields</div>
                    {fields.length === 0 && (
                        <div style={{ fontSize: 11, color: "#8f94b5", fontStyle: "italic" }}>
                            No datapoints detected yet — send CSV data to add names.
                        </div>
                    )}
                    {fields.map(field => (
                        <label key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, color: "#8f94b5", fontWeight: 600 }}>{field}</span>
                            <input
                                type="text"
                                value={aliases?.[field] ?? ""}
                                onChange={e => onAliasChange?.(field, e.target.value)}
                                placeholder={field}
                                maxLength={40}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    height: 30,
                                    borderRadius: 6,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "#171d40",
                                    color: "#ecf1ff",
                                    padding: "0 8px",
                                    fontSize: 12,
                                    outline: "none",
                                }}
                            />
                        </label>
                    ))}
                    <div style={{ fontSize: 10, color: "#7c84a8", fontStyle: "italic" }}>
                        Display names only — logs still store {fields[0] ? "datapoint N" : "raw CSV"}.
                    </div>
                </div>
            )}
        </div>
    );
}
