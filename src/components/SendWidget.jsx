import { useEffect, useState } from "react";
import { formatSendPayload } from "../utils/serialSend";
import "./SendWidget.css";

const HISTORY_LIMIT = 10;

export default function SendWidget() {
    const [isConnected, setIsConnected] = useState(false);
    const [message, setMessage] = useState("");
    const [appendNewline, setAppendNewline] = useState(true);
    const [history, setHistory] = useState([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!window.electronAPI?.onSerialConnectionStatus) return;
        return window.electronAPI.onSerialConnectionStatus(setIsConnected);
    }, []);

    const send = async text => {
        const payload = formatSendPayload(text, { appendNewline });
        if (!payload) return;
        if (!window.electronAPI?.sendSerialData) {
            setError("electronAPI not available");
            return;
        }
        setSending(true);
        setError("");
        try {
            const res = await window.electronAPI.sendSerialData(payload);
            if (res?.ok) {
                setHistory(prev => [...prev.slice(-(HISTORY_LIMIT - 1)), { time: new Date().toLocaleTimeString(), text: payload }]);
                setMessage("");
            } else {
                setError(res?.error || "Send failed");
            }
        } catch (err) {
            setError(err?.message || "Send failed");
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = event => {
        // Enter sends, Shift+Enter inserts a newline.
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send(message);
        }
    };

    const canSend = isConnected && !sending && formatSendPayload(message, { appendNewline }).length > 0;

    return (
        <div className="send-widget fill">
            <div className="widget-header">
                <div className="widget-name">Send</div>
                <div className={`connection-status ${isConnected ? "connected" : "disconnected"}`}>
                    {isConnected ? "● Connected" : "○ Disconnected"}
                </div>
            </div>

            <textarea
                className="send-input"
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Type a message… (Enter to send)" : "Connect a serial port to send"}
                spellCheck={false}
            />

            <div className="send-controls">
                <label className="send-newline-toggle" title="Append \\n to each message">
                    <input
                        type="checkbox"
                        checked={appendNewline}
                        onChange={e => setAppendNewline(e.target.checked)}
                    />
                    <span>+↵ newline</span>
                </label>
                <button className="send-button" onClick={() => send(message)} disabled={!canSend}>
                    {sending ? "Sending…" : "Send ⏎"}
                </button>
            </div>

            {error && <div className="send-error">⚠ {error}</div>}

            <div className="send-history">
                {history.length === 0 ? (
                    <div className="no-data">Nothing sent yet.</div>
                ) : (
                    history.map((item, index) => (
                        <div key={index} className="send-history-line">
                            <span className="timestamp">{item.time}</span>
                            <span className="data-value">→ {item.text}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
