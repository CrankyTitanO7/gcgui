import { useEffect, useState } from "react";
import { formatSendPayload } from "../utils/serialSend";
import "./SendWidget.css";

const PREVIEW_LIMIT = 24;

function previewMessage(message) {
    if (!message) return "";
    const flat = message.replace(/\n/g, "⏎");
    return flat.length > PREVIEW_LIMIT ? `${flat.slice(0, PREVIEW_LIMIT)}…` : flat;
}

export default function KeyButtonWidget({ shape }) {
    const displayName = shape?.name || "Key Button";
    const sendMessage = typeof shape?.sendMessage === "string" ? shape.sendMessage : "";
    // Toggle defaults on for shapes saved before the setting existed.
    const toggleEnabled = shape?.toggleEnabled !== false;
    // Toggle is visual only: it never gates or repeats sending. Every press
    // sends the configured message exactly once (+ Enter). With toggle off
    // the button is momentary (no latched ON/OFF state).
    const [toggled, setToggled] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [sending, setSending] = useState(false);
    const [lastSent, setLastSent] = useState(null);
    const [sentCount, setSentCount] = useState(0);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!window.electronAPI?.onSerialConnectionStatus) return;
        return window.electronAPI.onSerialConnectionStatus(setIsConnected);
    }, []);

    const payload = formatSendPayload(sendMessage, { appendNewline: true });
    const configured = payload.length > 0;

    const handlePress = async () => {
        if (toggleEnabled) setToggled(v => !v);
        if (!window.electronAPI?.sendSerialData) {
            setError("electronAPI not available");
            return;
        }
        if (!isConnected) {
            setError("Not connected");
            return;
        }
        if (!configured) {
            setError("No message configured — press E to edit settings");
            return;
        }
        setSending(true);
        setError("");
        try {
            const res = await window.electronAPI.sendSerialData(payload);
            if (res?.ok) {
                setLastSent({ text: previewMessage(sendMessage), time: new Date().toLocaleTimeString() });
                setSentCount(c => c + 1);
            } else {
                setError(res?.error || "Send failed");
            }
        } catch (err) {
            setError(err?.message || "Send failed");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="send-widget fill">
            <div className="widget-header">
                <div className="widget-name">{displayName}</div>
                <div className={`connection-status ${isConnected ? "connected" : "disconnected"}`}>
                    {isConnected ? "● Connected" : "○ Disconnected"}
                </div>
            </div>

            <button
                type="button"
                className={`keybutton ${toggleEnabled ? (toggled ? "on" : "off") : "momentary"}`}
                aria-pressed={toggleEnabled ? toggled : undefined}
                onClick={handlePress}
                disabled={sending}
                title={configured ? `Send "${previewMessage(sendMessage)}" + Enter` : "Press E to configure the message"}
            >
                {toggleEnabled && (
                    <span className={`keybutton-state ${toggled ? "on" : "off"}`}>{toggled ? "● ON" : "○ OFF"}</span>
                )}
                <span className="keybutton-label">{displayName}</span>
                <span className="keybutton-message">{configured ? `→ ${previewMessage(sendMessage)} ⏎` : "no message set"}</span>
            </button>

            <div className="keysend-hint">
                {toggleEnabled ? "Sends once per press. The toggle is visual only." : "Sends once per press (momentary)."}
            </div>

            {error && <div className="send-error">⚠ {error}</div>}

            <div className="keysend-status">
                <div className="keysend-last">
                    Last sent: <strong>{lastSent ? `${lastSent.text} @ ${lastSent.time}` : "—"}</strong>
                </div>
                <div className="keysend-count">Sent: {sentCount}</div>
            </div>
        </div>
    );
}
