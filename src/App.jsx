import { useEffect, useRef, useState } from "react";
import "./App.css";
// import BMSStatusWidget from "./components/BMS";
import ControlBar from "./components/ControlBar";
import Editor from "./components/Editor";
import FullHistoryGraph from "./components/FullHistoryGraph";
import LinePlotWidget from "./components/LinePlotWidget";
import NumberWidget from "./components/NumberWidget";
import Palette from "./components/Palette";
import { CANDataDebugger, CanProcProvider } from "./components/parsers/canproc";
import { CsvProcProvider } from "./components/parsers/csvproc";
import RadioWidget from "./components/RadioWidget";
import RawSerialWidget from "./components/RawSerialWidget";
import SendWidget from "./components/SendWidget";
import KeySendWidget from "./components/KeySendWidget";
import { createConfig, getDefaultConfig, loadConfig, saveConfig, validateConfig } from "./utils/config";
import { emitClearAll } from "./utils/clearAll";
import { parseCSVLog } from "./utils/csvLogParser";

const GRID_SIZE = 28;

const COMPONENTS = [
    { type: "number", label: "Number", w: 4, h: 3, defaultName: "Number Widget", defaultField: "speed" },
    { type: "line-plot", label: "Line Plot", w: 8, h: 4, defaultName: "Line Plot Widget", defaultField: "speed" },
    { type: "raw-serial", label: "Raw Serial", w: 8, h: 6, defaultName: "Raw Serial Widget", defaultField: "" },
    {
        type: "can-data",
        label: "can interpreter",
        w: 10,
        h: 6,
        defaultName: "CAN Data Widget",
        defaultField: "",
    },
    // { type: "bms-status", label: "BMS Status", w: 10, h: 8, defaultName: "BMS Status", defaultField: "" },
    { type: "radio", label: "Radio", w: 6, h: 4, defaultName: "Radio Widget", defaultField: "" },
    { type: "send", label: "Send", w: 8, h: 5, defaultName: "Send Widget", defaultField: "" },
    { type: "key-send", label: "Key Send", w: 6, h: 4, defaultName: "Key Send Widget", defaultField: "" },
];

const SUPPORTED_TYPES = new Set(COMPONENTS.map(c => c.type));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTypingTarget(target) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
}

function applyWidgetDefaults(shape) {
    const defaults = COMPONENTS.find(c => c.type === shape.type);
    if (!defaults) return shape;
    return {
        ...shape,
        name: shape.name || defaults.defaultName,
        dataField: shape.dataField || defaults.defaultField,
    };
}

function formatTimestamp(seconds) {
    if (seconds == null || isNaN(seconds)) return "0:00.000";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// ReplayBar — transport controls shown in log mode
// ---------------------------------------------------------------------------

function ReplayBar({ replayInfo, replayCurrentIndex, isRunning, onPlayPause, onSeek, onStepForward, onStepBackward, onShowFullHistory }) {
    const total = replayInfo?.messages?.length ?? 0;
    const currentTs = replayInfo?.messages?.[replayCurrentIndex]?.timestamp ?? 0;
    const totalTs = replayInfo?.messages?.[total - 1]?.timestamp ?? 0;

    const btn = (disabled, active) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 6,
        border: `1px solid ${active ? "#2e5c3a" : "#3a3a3a"}`,
        background: active ? "#1e3a2a" : disabled ? "#1a1a1a" : "#252525",
        color: active ? "#4caf72" : disabled ? "#444" : "#ccc",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        flexShrink: 0,
        transition: "background 0.15s, color 0.15s",
    });

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 14px",
                background: "#141414",
                borderBottom: "1px solid #2a2a2a",
                fontFamily: "monospace",
                userSelect: "none",
            }}
        >
            {/* Step backward */}
            <button
                title="Step backward (← arrow)"
                style={btn(replayCurrentIndex <= 0, false)}
                disabled={replayCurrentIndex <= 0}
                onClick={onStepBackward}
            >
                ⏮
            </button>

            {/* Play / Pause */}
            <button
                title={isRunning ? "Pause (Space)" : "Play (Space)"}
                style={btn(total === 0, isRunning)}
                disabled={total === 0}
                onClick={onPlayPause}
            >
                {isRunning ? "⏸" : "▶"}
            </button>

            {/* Step forward */}
            <button
                title="Step forward (→ arrow)"
                style={btn(replayCurrentIndex >= total - 1, false)}
                disabled={replayCurrentIndex >= total - 1}
                onClick={onStepForward}
            >
                ⏭
            </button>

            {/* Current timestamp */}
            <span style={{ fontSize: 11, color: "#888", minWidth: 88, textAlign: "right" }}>
                {formatTimestamp(currentTs)}
            </span>

            {/* Seek bar */}
            <input
                type="range"
                min={0}
                max={Math.max(total - 1, 1)}
                step={1}
                value={replayCurrentIndex}
                onChange={e => onSeek(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#4caf72", cursor: "pointer", height: 4 }}
            />

            {/* Total duration */}
            <span style={{ fontSize: 11, color: "#555", minWidth: 88 }}>{formatTimestamp(totalTs)}</span>

            {/* Message counter */}
            <span style={{ fontSize: 11, color: "#555", minWidth: 96, textAlign: "right" }}>
                {replayCurrentIndex} / {total}
            </span>

            {/* Full-file history graph */}
            <button
                title="Show full-file history graph"
                style={{ ...btn(total === 0, false), width: "auto", padding: "0 10px", fontSize: 12 }}
                disabled={total === 0}
                onClick={onShowFullHistory}
            >
                📈 Full history
            </button>
        </div>
    );
}

function renderComponent(shape, runtimeState = {}) {
    const mode = runtimeState.protocol === "csv" ? "csv" : "can";
    switch (shape.type) {
        case "number":
            return <NumberWidget shape={shape} mode={mode} />;
        case "line-plot":
            return <LinePlotWidget shape={shape} mode={mode} />;
        case "raw-serial":
            return <RawSerialWidget isRunning={runtimeState.isRunning} dataSource={runtimeState.dataSource} />;
        case "can-data":
            return <CANDataDebugger />;
        // case "bms-status":
        //     return <BMSStatusWidget shape={shape} />;
        case "radio":
            return <RadioWidget />;
        case "send":
            return <SendWidget />;
        case "key-send":
            return <KeySendWidget />;
        default:
            return <div className="fallback-block">Unsupported widget</div>;
    }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
    const [shapes, setShapes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [dataSource, setDataSource] = useState("live");
    const [protocol, setProtocol] = useState("can");
    const [usbPort, setUsbPort] = useState("");
    const [baudRate, setBaudRate] = useState(115200);
    const [availablePorts, setAvailablePorts] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [logFile, setLogFile] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isClearingAll, setIsClearingAll] = useState(false);
    const [fullHistoryOpen, setFullHistoryOpen] = useState(false);
    const [replayInfo, setReplayInfo] = useState(null);
    const [, setReplayStatus] = useState({ isPlaying: false, completed: false });
    const [layoutLocked, setLayoutLocked] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [propertiesEditor, setPropertiesEditor] = useState({
        open: false,
        shapeId: null,
        name: "",
        dataField: "",
    });

    // replayIndexRef    — mutable position the loop reads/writes (avoids stale closures)
    // replayCurrentIndex — state mirror of the above, drives the seek bar UI
    // seekTrigger       — incrementing restarts the loop from the current index position
    const replayCancelRef = useRef(false);
    const replayIndexRef = useRef(0);
    const [replayCurrentIndex, setReplayCurrentIndex] = useState(0);
    const [seekTrigger, setSeekTrigger] = useState(0);

    // ---------------------------------------------------------------------------
    // Inject a single message through the normal serial channel.
    // CAN messages are reconstructed in CRTD line format; CSV messages
    // replay as their raw line (both feed every parser via "serial-data").
    // ---------------------------------------------------------------------------

    function injectMessage(message) {
        if (!message || !window.electronAPI?.injectSerialData) return;
        if (message.kind === "csv" || !message.dataBytes) {
            window.electronAPI.injectSerialData(message.raw);
            return;
        }
        const dataHex = message.dataBytes.map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
        window.electronAPI.injectSerialData(`${message.timestamp} ${message.direction}${message.canIdRaw} ${dataHex}`);
    }

    // ---------------------------------------------------------------------------
    // Replay transport actions
    // ---------------------------------------------------------------------------

    function togglePlayPause() {
        setIsRunning(v => !v);
    }

    // Jump to an arbitrary message index.
    // While playing, cancels the in-flight loop and restarts it from the new position.
    function seekReplay(newIndex) {
        if (!replayInfo) return;
        const clamped = Math.max(0, Math.min(newIndex, replayInfo.messages.length - 1));
        replayIndexRef.current = clamped;
        setReplayCurrentIndex(clamped);
        if (isRunning) {
            replayCancelRef.current = true;
            setSeekTrigger(t => t + 1);
        }
    }

    // Advance one message, injecting it so widgets update instantly.
    function stepForward() {
        if (!replayInfo) return;
        const next = Math.min(replayIndexRef.current + 1, replayInfo.messages.length - 1);
        replayIndexRef.current = next;
        setReplayCurrentIndex(next);
        injectMessage(replayInfo.messages[next]);
        if (isRunning) {
            replayCancelRef.current = true;
            setSeekTrigger(t => t + 1);
        }
    }

    // Go back one message, re-injecting it so widgets reflect that point in time.
    function stepBackward() {
        if (!replayInfo) return;
        const prev = Math.max(replayIndexRef.current - 1, 0);
        replayIndexRef.current = prev;
        setReplayCurrentIndex(prev);
        injectMessage(replayInfo.messages[prev]);
        if (isRunning) {
            replayCancelRef.current = true;
            setSeekTrigger(t => t + 1);
        }
    }

    // ---------------------------------------------------------------------------
    // Clear All — clears graph + serial widgets, then rotates the live
    // recording (stop current file, begin a new one) when recording.
    // ---------------------------------------------------------------------------

    async function handleClearAll() {
        if (isClearingAll) return;
        setIsClearingAll(true);
        try {
            emitClearAll();

            const api = window.electronAPI;
            const shouldRotateRecording =
                dataSource === "live" && isRunning && Boolean(usbPort?.trim()) && api?.stopLiveRecording && api?.startLiveRecording;
            if (shouldRotateRecording) {
                try {
                    await api.stopLiveRecording();
                } catch (err) {
                    console.error("Failed to stop live recording on clear all:", err);
                }
                try {
                    const r = await api.startLiveRecording(protocol);
                    if (!r?.ok) console.error("Failed to start live recording on clear all:", r?.error);
                } catch (err) {
                    console.error("Failed to start live recording on clear all:", err);
                }
            }
        } finally {
            setIsClearingAll(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Serial ports
    // ---------------------------------------------------------------------------

    const refreshPorts = async () => {
        let attempts = 0;
        const waitForAPI = () => {
            if (window.electronAPI?.getSerialPorts) return true;
            if (++attempts < 50) {
                setTimeout(waitForAPI, 100);
                return false;
            }
            console.error("electronAPI not available after 5 seconds");
            return false;
        };
        if (!waitForAPI()) return;
        setIsScanning(true);
        try {
            const ports = await window.electronAPI.getSerialPorts();
            setAvailablePorts(ports);
            if (ports.length === 1 && !usbPort) setUsbPort(ports[0].path);
        } catch (err) {
            console.error("Failed to refresh ports:", err);
        } finally {
            setIsScanning(false);
        }
    };

    useEffect(() => {
        let attempts = 0;
        const waitForAPI = () => {
            if (window.electronAPI?.getSerialPorts) {
                setIsScanning(true);
                window.electronAPI
                    .getSerialPorts()
                    .then(ports => {
                        setAvailablePorts(ports);
                        if (ports.length === 1 && !usbPort) setUsbPort(ports[0].path);
                    })
                    .catch(err => console.error("Failed to scan ports:", err))
                    .finally(() => setIsScanning(false));
                return;
            }
            if (++attempts < 50) setTimeout(waitForAPI, 100);
            else console.error("electronAPI not available after 5 seconds");
        };
        waitForAPI();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (usbPort && window.electronAPI?.connectSerialPort) {
            window.electronAPI.connectSerialPort(usbPort, baudRate);
        } else if (!usbPort && window.electronAPI?.disconnectSerialPort) {
            window.electronAPI.disconnectSerialPort();
        }
    }, [usbPort, baudRate]);

    useEffect(() => {
        const ipc = window.electron?.ipcRenderer;
        if (!ipc) return;
        const handler = (_event, newRate) => {
            if (usbPort) ipc.send("set-baud-rate", newRate);
        };
        ipc.on("baud-rate-changed", handler);
        return () => ipc.off("baud-rate-changed", handler);
    }, [usbPort]);

    // ---------------------------------------------------------------------------
    // Live recording
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.startLiveRecording || !api?.stopLiveRecording) return;
        const shouldRecord = dataSource === "live" && isRunning && Boolean(usbPort?.trim());
        if (shouldRecord) {
            api.startLiveRecording(protocol)
                .then(r => {
                    if (!r?.ok) console.error("Failed to start live recording:", r?.error);
                })
                .catch(err => console.error("Failed to start live recording:", err));
        } else {
            api.stopLiveRecording().catch(err => console.error("Failed to stop live recording:", err));
        }
    }, [dataSource, isRunning, usbPort, protocol]);

    useEffect(() => {
        return () => {
            window.electronAPI
                ?.stopLiveRecording?.()
                .catch(err => console.error("Failed to stop live recording on cleanup:", err));
        };
    }, []);

    // ---------------------------------------------------------------------------
    // Log file parsing (CRTD for CAN, raw CSV for CSV — by file extension)
    // ---------------------------------------------------------------------------

    useEffect(() => {
        if (!logFile || dataSource !== "log") {
            setReplayInfo(null);
            return;
        }

        const loadFile = async () => {
            try {
                const content = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = () => reject(new Error("Failed to read file"));
                    reader.readAsText(logFile);
                });

                // CSV replay: raw "time, value1, value2, ..." lines
                if (logFile.name?.toLowerCase().endsWith(".csv")) {
                    const parsed = parseCSVLog(content);
                    if (parsed.messages.length === 0) {
                        console.error("Empty CSV file (no data rows)");
                        setReplayInfo(null);
                        return;
                    }
                    console.log(`✅ Parsed ${parsed.messages.length} rows from CSV file`);

                    // Always reset position when a new file is loaded
                    replayIndexRef.current = 0;
                    setReplayCurrentIndex(0);
                    setReplayStatus({ isPlaying: false, completed: false });
                    setReplayInfo({
                        header: parsed.header,
                        messages: parsed.messages,
                        messageCount: parsed.messages.length,
                        duration:
                            parsed.messages.length > 0
                                ? parsed.messages[parsed.messages.length - 1].timestamp
                                : 0,
                    });
                    return;
                }

                const lines = content.split("\n").filter(l => l.trim());
                if (lines.length === 0) {
                    console.error("Empty CRTD file");
                    return;
                }

                const headerLine = lines[0];
                const header = headerLine.startsWith("CXXRTL")
                    ? { raw: headerLine, timestamp: headerLine.replace("CXXRTL gcgui live capture ", "") }
                    : null;

                const messages = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const parts = line.split(/\s+/);
                    if (parts.length < 3) continue;

                    const timestamp = parseFloat(parts[0]);
                    if (isNaN(timestamp)) continue;

                    let canId = parts[1];
                    let direction = "R";
                    if (canId.startsWith("R") || canId.startsWith("T")) {
                        direction = canId[0];
                        canId = canId.substring(1);
                    }

                    const dataBytes = [];
                    for (let j = 2; j < parts.length; j++) {
                        const byte = parseInt(parts[j], 16);
                        if (!isNaN(byte)) dataBytes.push(byte);
                    }
                    if (dataBytes.length === 0) continue;

                    messages.push({
                        kind: "can",
                        timestamp,
                        direction,
                        canId: "0x" + parseInt(canId, 16).toString(16).toLowerCase(),
                        canIdRaw: canId,
                        dataBytes,
                        raw: line,
                    });
                }

                console.log(`✅ Parsed ${messages.length} messages from CRTD file`);

                // Always reset position when a new file is loaded
                replayIndexRef.current = 0;
                setReplayCurrentIndex(0);
                setReplayStatus({ isPlaying: false, completed: false });
                setReplayInfo({
                    header,
                    messages,
                    messageCount: messages.length,
                    duration: messages.length > 0 ? messages[messages.length - 1].timestamp : 0,
                });
            } catch (err) {
                console.error("❌ Failed to load CRTD file:", err);
                setReplayInfo(null);
            }
        };

        loadFile();
    }, [logFile, dataSource]);

    // ---------------------------------------------------------------------------
    // Replay loop
    //
    // Key design decisions:
    //   • replayCancelRef controls cancellation — checked inside the closure so it
    //     works across re-renders without stale values
    //   • replayIndexRef holds the mutable playhead position the loop reads/writes
    //   • seekTrigger in the dep array lets seek/step restart the loop cleanly
    //     without toggling isRunning (which would reset position)
    //   • replayStatus.isPlaying deliberately NOT in the dep array — it was the
    //     original cause of the loop being killed after the first message
    // ---------------------------------------------------------------------------

    useEffect(() => {
        if (dataSource !== "log" || !replayInfo) return;

        if (!isRunning) {
            replayCancelRef.current = true;
            setReplayStatus(prev => ({ ...prev, isPlaying: false }));
            return;
        }

        // If we finished last time, restart from the beginning
        if (replayIndexRef.current >= replayInfo.messages.length) {
            replayIndexRef.current = 0;
            setReplayCurrentIndex(0);
        }

        replayCancelRef.current = false;
        setReplayStatus({ isPlaying: true, completed: false });

        const playNext = () => {
            if (replayCancelRef.current) return;

            const index = replayIndexRef.current;
            if (index >= replayInfo.messages.length) {
                setReplayStatus({ isPlaying: false, completed: true });
                setIsRunning(false);
                return;
            }

            const message = replayInfo.messages[index];
            injectMessage(message);

            replayIndexRef.current = index + 1;
            setReplayCurrentIndex(index + 1);

            if (replayIndexRef.current < replayInfo.messages.length) {
                const next = replayInfo.messages[replayIndexRef.current];
                const delay = Math.min((next.timestamp - message.timestamp) * 1000, 100);
                setTimeout(playNext, delay);
            } else {
                setReplayStatus({ isPlaying: false, completed: true });
                setIsRunning(false);
            }
        };

        playNext();

        return () => {
            replayCancelRef.current = true;
            setReplayStatus(prev => ({ ...prev, isPlaying: false }));
        };
    }, [isRunning, dataSource, replayInfo, seekTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for replay status updates from the main process
    useEffect(() => {
        if (!window.electronAPI?.onReplayStatus) return;
        return window.electronAPI.onReplayStatus(status => {
            setReplayStatus(status);
            if (status.completed) setIsRunning(false);
        });
    }, []);

    // ---------------------------------------------------------------------------
    // Context-menu auto-close
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener("click", close);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("click", close);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, []);

    // ---------------------------------------------------------------------------
    // Keyboard shortcuts
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const handleKeyDown = event => {
            const key = event.key.toLowerCase();
            const typing = isTypingTarget(event.target);

            // Key-Send capture wins over app shortcuts while armed
            // (Escape is never captured and stays app-level).
            if (window.__gcguiKeyCapture && event.key !== "Escape") return;

            if (event.key === "Escape") {
                if (fullHistoryOpen) {
                    event.preventDefault();
                    setFullHistoryOpen(false);
                    return;
                }
                if (propertiesEditor.open) {
                    event.preventDefault();
                    closePropertiesEditor();
                    return;
                }
                if (paletteOpen) {
                    event.preventDefault();
                    setPaletteOpen(false);
                    return;
                }
                if (contextMenu) {
                    setContextMenu(null);
                }
                return;
            }

            if (key === "e" && selectedId && !typing && !propertiesEditor.open && !layoutLocked) {
                event.preventDefault();
                openPropertiesEditor(selectedId);
                return;
            }

            if (event.key === "Delete" && selectedId && !typing) {
                event.preventDefault();
                deleteShape(selectedId);
                return;
            }

            // Replay shortcuts (log mode only, not while typing into an input)
            if (dataSource === "log" && !typing) {
                if (event.key === "ArrowRight") {
                    event.preventDefault();
                    stepForward();
                    return;
                }
                if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    stepBackward();
                    return;
                }
                if (key === " ") {
                    event.preventDefault();
                    togglePlayPause();
                    return;
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedId,
        propertiesEditor.open,
        paletteOpen,
        fullHistoryOpen,
        contextMenu,
        layoutLocked,
        shapes,
        dataSource,
        isRunning,
        replayInfo,
    ]);

    // ---------------------------------------------------------------------------
    // Shape management
    // ---------------------------------------------------------------------------

    function addShape(component) {
        if (layoutLocked) return;
        const id = Date.now();
        setShapes(s => [
            ...s,
            {
                id,
                type: component.type,
                x: 0,
                y: 0,
                width: component.w * GRID_SIZE,
                height: component.h * GRID_SIZE,
                name: component.defaultName,
                dataField: component.defaultField,
            },
        ]);
        setSelectedId(id);
    }

    function onUpdateShape(id, patch) {
        if (layoutLocked) return;
        setShapes(arr => arr.map(s => (s.id === id ? { ...s, ...patch } : s)));
    }

    function deleteShape(id) {
        if (layoutLocked || !id) return;
        setShapes(arr => arr.filter(s => s.id !== id));
        setContextMenu(menu => (menu?.shapeId === id ? null : menu));
        setPropertiesEditor(curr =>
            curr.shapeId === id ? { open: false, shapeId: null, name: "", dataField: "" } : curr,
        );
        setSelectedId(curr => (curr === id ? null : curr));
    }

    function openPropertiesEditor(shapeId) {
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape || layoutLocked) return;
        setPropertiesEditor({ open: true, shapeId, name: shape.name || "", dataField: shape.dataField || "" });
    }

    function closePropertiesEditor() {
        setPropertiesEditor({ open: false, shapeId: null, name: "", dataField: "" });
    }

    function applyPropertiesEditorChanges() {
        if (layoutLocked || !propertiesEditor.shapeId) return;
        onUpdateShape(propertiesEditor.shapeId, {
            name: propertiesEditor.name.trim() || "Widget",
            dataField: propertiesEditor.dataField.trim() || "speed",
        });
        closePropertiesEditor();
    }

    // ---------------------------------------------------------------------------
    // Config persistence
    // ---------------------------------------------------------------------------

    function saveConfiguration() {
        saveConfig(createConfig(shapes, panX, panY, zoom), "pitwall-config");
    }

    function loadConfiguration(file) {
        loadConfig(file)
            .then(loaded => {
                const validated = validateConfig(loaded);
                const supported = validated.shapes.filter(s => SUPPORTED_TYPES.has(s.type)).map(applyWidgetDefaults);
                setShapes(supported);
                setPanX(validated.view.panX);
                setPanY(validated.view.panY);
                setZoom(validated.view.zoom);
                setSelectedId(null);
                setContextMenu(null);
                closePropertiesEditor();
            })
            .catch(err => {
                console.error("Failed to load configuration:", err);
                alert("Failed to load configuration file. Please check the file format.");
            });
    }

    function resetConfiguration() {
        if (layoutLocked) return;
        const def = getDefaultConfig();
        setShapes(def.shapes);
        setPanX(def.view.panX);
        setPanY(def.view.panY);
        setZoom(def.view.zoom);
        setSelectedId(null);
        setContextMenu(null);
        closePropertiesEditor();
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <CanProcProvider isRunning={isRunning} dataSource={dataSource}>
            <CsvProcProvider isRunning={isRunning} dataSource={dataSource}>
                <div className="app-shell" onClick={() => setContextMenu(null)}>
                    <ControlBar
                        dataSource={dataSource}
                        setDataSource={setDataSource}
                        protocol={protocol}
                        setProtocol={setProtocol}
                        usbPort={usbPort}
                        setUsbPort={setUsbPort}
                        baudRate={baudRate}
                        setBaudRate={setBaudRate}
                        logFile={logFile}
                        setLogFile={setLogFile}
                        isRunning={isRunning}
                        setIsRunning={setIsRunning}
                        onOpenPalette={() => setPaletteOpen(true)}
                        layoutLocked={layoutLocked}
                        availablePorts={availablePorts}
                        isScanning={isScanning}
                        onRefreshPorts={refreshPorts}
                        onClearAll={handleClearAll}
                        isClearingAll={isClearingAll}
                    />

                    {/* Transport bar — only visible in log replay mode */}
                    {dataSource === "log" && (
                        <ReplayBar
                            replayInfo={replayInfo}
                            replayCurrentIndex={replayCurrentIndex}
                            isRunning={isRunning}
                            onPlayPause={togglePlayPause}
                            onSeek={seekReplay}
                            onStepForward={stepForward}
                            onStepBackward={stepBackward}
                            onShowFullHistory={() => setFullHistoryOpen(true)}
                        />
                    )}

                    <Editor
                        shapes={shapes}
                        onUpdateShape={onUpdateShape}
                        onSelectShape={setSelectedId}
                        onOpenShapeMenu={({ id, x, y }) => setContextMenu({ shapeId: id, x, y })}
                        selectedId={selectedId}
                        panX={panX}
                        setPanX={setPanX}
                        panY={panY}
                        setPanY={setPanY}
                        gridSize={GRID_SIZE}
                        zoom={zoom}
                        setZoom={setZoom}
                        renderShape={shape => renderComponent(shape, { isRunning, dataSource, protocol })}
                    />

                    {/* Full-file history graph — opened from the replay bar */}
                    {dataSource === "log" && fullHistoryOpen && replayInfo && (
                        <FullHistoryGraph
                            messages={replayInfo.messages}
                            replayCurrentIndex={replayCurrentIndex}
                            onSeek={seekReplay}
                            onClose={() => setFullHistoryOpen(false)}
                        />
                    )}

                    <Palette
                        components={COMPONENTS}
                        onAdd={addShape}
                        onDelete={() => deleteShape(selectedId)}
                        onSave={saveConfiguration}
                        onLoad={loadConfiguration}
                        onReset={resetConfiguration}
                        hasSelection={Boolean(selectedId)}
                        isOpen={paletteOpen}
                        onClose={() => setPaletteOpen(false)}
                        isLocked={layoutLocked}
                        onToggleLayoutLock={() => setLayoutLocked(v => !v)}
                    />

                    {contextMenu && (
                        <div
                            className="widget-context-menu"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                className="widget-context-option"
                                disabled={layoutLocked}
                                onClick={() => {
                                    openPropertiesEditor(contextMenu.shapeId);
                                    setContextMenu(null);
                                }}
                            >
                                Edit
                            </button>
                            <button
                                className="widget-context-option danger"
                                disabled={layoutLocked}
                                onClick={() => {
                                    deleteShape(contextMenu.shapeId);
                                    setContextMenu(null);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    )}

                    {propertiesEditor.open && (
                        <div className="properties-overlay" onClick={closePropertiesEditor}>
                            <div className="properties-modal" onClick={e => e.stopPropagation()}>
                                <h3>Widget Properties</h3>
                                <form
                                    className="properties-form"
                                    onSubmit={e => {
                                        e.preventDefault();
                                        applyPropertiesEditorChanges();
                                    }}
                                >
                                    <label htmlFor="widget-name">Name</label>
                                    <input
                                        id="widget-name"
                                        type="text"
                                        value={propertiesEditor.name}
                                        placeholder="Widget name"
                                        onChange={e => setPropertiesEditor(curr => ({ ...curr, name: e.target.value }))}
                                    />
                                    <label htmlFor="widget-data-field">Data Field</label>
                                    <input
                                        id="widget-data-field"
                                        type="text"
                                        value={propertiesEditor.dataField}
                                        placeholder="Data field"
                                        onChange={e =>
                                            setPropertiesEditor(curr => ({ ...curr, dataField: e.target.value }))
                                        }
                                    />
                                    <div className="properties-actions">
                                        <button type="button" className="secondary" onClick={closePropertiesEditor}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="primary">
                                            Save
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </CsvProcProvider>
        </CanProcProvider>
    );
}

export default App;
