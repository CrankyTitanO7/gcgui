import { useEffect, useState } from "react";
import { describePayload, keyToSendPayload, shouldCaptureKey } from "../utils/serialSend";
import "./SendWidget.css";

export default function KeySendWidget() {
    const [enabled, setEnabled] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [lastSent, setLastSent] = useState(null);
    const [sentCount, setSentCount] = useState(0);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!window.electronAPI?.onSerialConnectionStatus) return;
        return window.electronAPI.onSerialConnectionStatus(setIsConnected);
    }, []);

    // Publish capture state so App-level shortcuts stand down while armed
    // (Escape is still handled by the app).
    useEffect(() => {
        window.__gcguiKeyCapture = enabled;
        return () => {
            window.__gcguiKeyCapture = false;
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        if (!window.electronAPI?.sendSerialData) {
            setError("electronAPI not available");
            return;
        }

        const handler = async event => {
            // The switch itself stays operable by keyboard while armed.
            if (event.target?.closest?.("[data-keysend-switch]")) return;
            if (!shouldCaptureKey(event)) return;
            const payload = keyToSendPayload(event.key);
            if (payload == null) return;
            // Capture wins over app shortcuts / scrolling while armed.
            event.preventDefault();
            event.stopPropagation();
            try {
                const res = await window.electronAPI.sendSerialData(payload);
                if (res?.ok) {
                    setLastSent({ label: describePayload(payload), time: new Date().toLocaleTimeString() });
                    setSentCount(c => c + 1);
                    setError("");
                } else {
                    setError(res?.error || "Send failed");
                }
            } catch (err) {
                setError(err?.message || "Send failed");
            }
        };

        window.addEventListener("keydown", handler, true);
        return () => window.removeEventListener("keydown", handler, true);
    }, [enabled]);

    return (
        <div className="send-widget fill">
            <div className="widget-header">
                <div className="widget-name">Key Send</div>
                <div className={`connection-status ${isConnected ? "connected" : "disconnected"}`}>
                    {isConnected ? "● Connected" : "○ Disconnected"}
                </div>
            </div>

            <label className="keysend-switch-row" title="Capture keystrokes and send them immediately">
                <span className={`keysend-state ${enabled ? "on" : "off"}`}>{enabled ? "● Listening" : "○ Off"}</span>
                <span
                    className={`switch ${enabled ? "on" : ""}`}
                    data-keysend-switch
                    role="switch"
                    aria-checked={enabled}
                    tabIndex={0}
                    onClick={() => setEnabled(v => !v)}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEnabled(v => !v);
                        }
                    }}
                >
                    <span className="knob" />
                </span>
            </label>

            <div className="keysend-hint">
                {enabled
                    ? "Typing sends each key instantly (Enter = newline). Typing in inputs is ignored."
                    : "Arm the switch to stream keystrokes to serial."}
            </div>

            {error && <div className="send-error">⚠ {error}</div>}

            <div className="keysend-status">
                <div className="keysend-last">
                    Last key: <strong>{lastSent ? `${lastSent.label} @ ${lastSent.time}` : "—"}</strong>
                </div>
                <div className="keysend-count">Sent: {sentCount}</div>
            </div>
        </div>
    );
}
