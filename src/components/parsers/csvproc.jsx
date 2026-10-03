import { createContext, useContext, useEffect, useState } from "react";

// A parser for comma separated values.
// Each line is `time, value1, value2, ...` and produces fields named
// "time" for the 0th element, then "datapoint 1", "datapoint 2", ... for
// each element after it. Values are numeric when parseable, otherwise kept
// as raw strings.

export const CSVDataContext = createContext();

export const parseCSVMessage = rawMessage => {
    try {
        const message = rawMessage.trim();
        if (!message || !message.includes(",")) return null;

        const cells = message.split(",").map(cell => cell.trim());
        if (cells.length === 0) return null;

        const timestamp = new Date().toISOString();

        const toField = cell => {
            if (cell === "") return { value: null, unit: "", raw: cell };
            const num = Number(cell);
            if (!Number.isNaN(num)) return { value: num, unit: "", raw: num };
            return { value: cell, unit: "", raw: cell };
        };

        const fields = { time: toField(cells[0]) };
        for (let i = 1; i < cells.length; i++) {
            fields[`datapoint ${i}`] = toField(cells[i]);
        }

        return { id: "csv", name: "CSV", timestamp, fields };
    } catch (error) {
        console.error("Error parsing CSV message:", error, rawMessage);
        return null;
    }
};

// ---------------------------------------------------------------------------
// Global state hook
// ---------------------------------------------------------------------------
const useCSVData = () => {
    const [csvData, setCSVData] = useState({});
    const [lastUpdate, setLastUpdate] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(false);

    const handleSerialData = data => {
        const parsedMessage = parseCSVMessage(data.toString());
        if (parsedMessage) {
            setCSVData(prev => ({ ...prev, [parsedMessage.id]: parsedMessage }));
            setLastUpdate(new Date());
        }
    };

    const handleConnectionStatus = status => setConnectionStatus(status);

    return { csvData, lastUpdate, connectionStatus, handleSerialData, handleConnectionStatus };
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const CsvProcProvider = ({ children, isRunning = true, dataSource = "live" }) => {
    const csvData = useCSVData();

    useEffect(() => {
        if (!window.electronAPI) {
            console.error("electronAPI not available in csvProc");
            return;
        }

        let cleanupData = null;
        let cleanupStatus = null;
        let cleanupReplayStatus = null;

        if (window.electronAPI.onSerialData) {
            // Always listening: serial data is processed even when not
            // recording. The topbar Start/Stop button only controls
            // live recording to file (and replay play/pause in log mode).
            cleanupData = window.electronAPI.onSerialData(data => {
                csvData.handleSerialData(data);
            });
        }
        if (window.electronAPI.onSerialConnectionStatus) {
            cleanupStatus = window.electronAPI.onSerialConnectionStatus(csvData.handleConnectionStatus);
        }

        // Listen for replay status to update connection status in log mode
        if (window.electronAPI.onReplayStatus) {
            cleanupReplayStatus = window.electronAPI.onReplayStatus(status => {
                // In log mode, treat replay as "connected"
                if (dataSource === "log") {
                    csvData.handleConnectionStatus(status.isPlaying);
                }
            });
        }

        // In log mode, set initial connection status based on isRunning
        if (dataSource === "log") {
            csvData.handleConnectionStatus(isRunning);
        }

        return () => {
            if (cleanupData) cleanupData();
            if (cleanupStatus) cleanupStatus();
            if (cleanupReplayStatus) cleanupReplayStatus();
        };
    }, [csvData.handleSerialData, csvData.handleConnectionStatus, isRunning, dataSource]);

    return <CSVDataContext.Provider value={csvData}>{children}</CSVDataContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export const useCSVDataHook = () => {
    const context = useContext(CSVDataContext);
    if (!context) throw new Error("useCSVDataHook must be used within a CsvProcProvider");
    return context;
};

export default CsvProcProvider;
