const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// Debug tooling is enabled in development by default and disabled in packaged apps.
// You can override in development with: ELECTRON_DEBUG_TOOLS=0
const isDebugToolsEnabled = !app.isPackaged && process.env.ELECTRON_DEBUG_TOOLS !== "0";

// Global variables
let win = null;
let port = null;
let parser = null;
let currentBaudRate = 115200;
let recordingEnabled = false;
let recordingFd = null;
let recordingFilePath = null;

function getRecordingDirectory() {
    return path.join(app.getPath("documents"), "gcgui-recordings");
}

function getTimestampForFilename() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

function startLiveRecording() {
    if (recordingEnabled && recordingFd !== null && recordingFilePath) {
        return recordingFilePath;
    }

    const dir = getRecordingDirectory();
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `live-${getTimestampForFilename()}.crtd`);
    const fd = fs.openSync(filePath, "a");

    fs.writeSync(fd, `CXXRTL gcgui live capture ${new Date().toISOString()}\n`);
    fs.fsyncSync(fd);

    recordingEnabled = true;
    recordingFd = fd;
    recordingFilePath = filePath;

    console.log("📝 Live recording started:", filePath);
    return filePath;
}

function stopLiveRecording() {
    if (recordingFd === null) {
        recordingEnabled = false;
        recordingFilePath = null;
        return;
    }

    const fd = recordingFd;
    const activeFile = recordingFilePath;
    recordingEnabled = false;
    recordingFd = null;
    recordingFilePath = null;

    try {
        fs.closeSync(fd);
        console.log("📝 Live recording stopped:", activeFile);
    } catch (error) {
        console.error("❌ Failed closing live recording file:", error);
    }
}

// Import serial port modules at the top level
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// Function to list available serial ports
function listSerialPorts() {
    console.log("Scanning for serial ports...");
    return SerialPort.list()
        .then(ports => {
            console.log("Found ports:", ports);
            return ports.map(port => ({
                path: port.path,
                manufacturer: port.manufacturer || "Unknown",
                pnpId: port.pnpId || "",
                vendorId: port.vendorId || "",
                productId: port.productId || "",
            }));
        })
        .catch(error => {
            console.error("Error scanning ports:", error);
            return [];
        });
}

// Function to connect to a serial port
// Function to connect to a serial port - IMPROVED VERSION
// Function to connect to a serial port - DEBUGGED VERSION
// Function to connect to a serial port - WITH ARDUINO RESET DELAY
// Function to connect to a serial port - WITH BAUD RATE SUPPORT
function connectToPort(portPath, baudRate = currentBaudRate) {
    console.log("========================================");
    console.log("🔌 CONNECT REQUEST:", portPath);
    console.log("   Baud Rate:", baudRate);
    console.log("========================================");

    // Close existing port if open
    if (port && port.isOpen) {
        console.log("⚠️  Closing existing port...");
        try {
            port.close();
        } catch (err) {
            console.error("Error closing port:", err);
        }
    }

    try {
        // Create new port connection with error handling
        console.log("📡 Creating SerialPort instance...");
        port = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            autoOpen: true,
        });

        console.log("📡 SerialPort created, setting up parser...");
        parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

        // Handle data reception
        parser.on("data", line => {
            console.log("📥 RAW DATA RECEIVED:", line);
            console.log("   Length:", line.length, "bytes");
            console.log("   Content:", JSON.stringify(line));

            if (recordingEnabled && recordingFd !== null) {
                try {
                    const frame = String(line).replace(/\r$/, "");
                    if (frame.length > 0) {
                        fs.writeSync(recordingFd, `${frame}\n`);
                        fs.fsyncSync(recordingFd);
                    }
                } catch (error) {
                    console.error("❌ Failed to write live frame to recording file:", error);
                    stopLiveRecording();
                }
            }

            // Send to renderer via IPC
            if (win && win.webContents) {
                console.log("   ✅ Sending to renderer...");
                win.webContents.send("serial-data", line);
                console.log("   ✅ Data sent to renderer");
            } else {
                console.log("   ❌ Window not available!");
            }
        });

        // Handle connection events
        port.on("open", () => {
            console.log("✅ Serial port OPENED:", portPath);
            console.log("   Baud rate:", port.baudRate);
            console.log("   Path:", port.path);
            console.log("⏳ Waiting 2 seconds for Arduino to reset...");

            // Arduino resets when serial connection opens (DTR/RTS)
            // Wait for bootloader to finish before marking as connected
            setTimeout(() => {
                console.log("✅ Arduino should be ready now");
                if (win && win.webContents) {
                    win.webContents.send("serial-connection-status", true);
                    console.log("   ✅ Connection status sent to renderer");
                }
            }, 2000); // Wait 2 seconds for Arduino to reset
        });

        port.on("close", () => {
            console.log("❌ Serial port CLOSED");
            if (win && win.webContents) {
                win.webContents.send("serial-connection-status", false);
            }
        });

        port.on("error", err => {
            console.error("❌ SERIAL PORT ERROR:", err.message);
            console.error("   Full error:", err);
            if (win && win.webContents) {
                win.webContents.send("serial-connection-status", false);
            }
        });

        console.log("✅ Port setup complete, waiting for data...");
    } catch (error) {
        console.error("❌ FAILED to create serial port:", error);
        if (win && win.webContents) {
            win.webContents.send("serial-connection-status", false);
        }
    }
}

// IPC handlers
ipcMain.handle("get-serial-ports", async () => {
    try {
        const ports = await listSerialPorts();
        return ports;
    } catch (error) {
        console.error("Error listing serial ports:", error);
        return [];
    }
});

ipcMain.on("connect-serial-port", (event, portPath) => {
    connectToPort(portPath);
});

ipcMain.handle("start-live-recording", async () => {
    try {
        const filePath = startLiveRecording();
        return { ok: true, filePath };
    } catch (error) {
        console.error("❌ Failed to start live recording:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

ipcMain.handle("stop-live-recording", async () => {
    try {
        stopLiveRecording();
        return { ok: true };
    } catch (error) {
        console.error("❌ Failed to stop live recording:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

ipcMain.on("disconnect-serial-port", () => {
    if (port && port.isOpen) {
        port.close();
    }
});

// Handle baud rate changes
ipcMain.on("set-baud-rate", (event, baudRate) => {
    console.log("🔧 Baud rate changed to:", baudRate);
    currentBaudRate = baudRate;

    // If currently connected, reconnect with new baud rate
    if (port && port.isOpen) {
        const currentPortPath = port.path;
        console.log("🔄 Reconnecting with new baud rate...");
        connectToPort(currentPortPath, baudRate);
    }
});

// IPC handler to inject serial data (used by replay)
ipcMain.on("inject-serial-data", (event, data) => {
    if (win && win.webContents) {
        win.webContents.send("serial-data", data);
    }
});

// Replay state
let replayState = {
    isPlaying: false,
    messages: [],
    currentIndex: 0,
    playbackSpeed: 1.0,
    timeoutId: null,
};

// IPC handler to load and parse CRTD file
ipcMain.handle("load-crtd-file", async (event, filePath) => {
    try {
        console.log("📂 Loading CRTD file:", filePath);
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n").filter(line => line.trim());

        if (lines.length === 0) {
            return { ok: false, error: "Empty file" };
        }

        // Parse header
        const headerLine = lines[0];
        let header = null;

        if (headerLine.startsWith("CXXRTL")) {
            header = {
                raw: headerLine,
                timestamp: headerLine.replace("CXXRTL gcgui live capture ", ""),
            };
        }

        // Parse CAN messages
        const messages = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(/\s+/);

            if (parts.length < 3) continue;

            const timestamp = parseFloat(parts[0]);
            if (isNaN(timestamp)) continue;

            // CAN ID might have R/T prefix (Received/Transmitted)
            let canId = parts[1];
            let direction = "R"; // Default to Received

            if (canId.startsWith("R") || canId.startsWith("T")) {
                direction = canId[0];
                canId = canId.substring(1);
            }

            // Parse data bytes (everything after CAN ID)
            const dataBytes = [];
            for (let j = 2; j < parts.length; j++) {
                const byte = parseInt(parts[j], 16);
                if (!isNaN(byte)) {
                    dataBytes.push(byte);
                }
            }

            if (dataBytes.length === 0) continue;

            // Convert CAN ID to standard format (with 0x prefix)
            const canIdNum = parseInt(canId, 16);
            const formattedCanId = "0x" + canIdNum.toString(16).toLowerCase();

            messages.push({
                timestamp,
                direction,
                canId: formattedCanId,
                canIdRaw: canId,
                dataBytes,
                raw: line,
            });
        }

        console.log(`✅ Loaded ${messages.length} messages from CRTD file`);

        // Reset replay state
        replayState = {
            isPlaying: false,
            messages,
            currentIndex: 0,
            playbackSpeed: 1.0,
            timeoutId: null,
        };

        return {
            ok: true,
            header,
            messageCount: messages.length,
            duration: messages.length > 0 ? messages[messages.length - 1].timestamp : 0,
        };
    } catch (error) {
        console.error("❌ Failed to load CRTD file:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

// IPC handler to start replay
ipcMain.handle("start-replay", async (event, speed = 1.0) => {
    try {
        if (replayState.messages.length === 0) {
            return { ok: false, error: "No messages loaded" };
        }

        console.log(`▶️ Starting replay at ${speed}x speed`);
        replayState.isPlaying = true;
        replayState.playbackSpeed = speed;
        replayState.currentIndex = 0;

        // Start replay loop
        const playNextMessage = () => {
            if (!replayState.isPlaying || replayState.currentIndex >= replayState.messages.length) {
                if (replayState.currentIndex >= replayState.messages.length) {
                    console.log("✅ Replay completed");
                    replayState.isPlaying = false;
                    if (win && win.webContents) {
                        win.webContents.send("replay-status", { isPlaying: false, completed: true });
                    }
                }
                return;
            }

            const message = replayState.messages[replayState.currentIndex];

            // Send message to renderer
            if (win && win.webContents) {
                // Format as serial data string (same format as live data)
                const dataHex = message.dataBytes.map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
                const serialLine = `${message.timestamp} ${message.direction}${message.canIdRaw} ${dataHex}`;
                win.webContents.send("serial-data", serialLine);
            }

            // Calculate delay to next message
            const nextIndex = replayState.currentIndex + 1;
            if (nextIndex < replayState.messages.length) {
                const nextMessage = replayState.messages[nextIndex];
                const delay = Math.max(
                    0,
                    ((nextMessage.timestamp - message.timestamp) / replayState.playbackSpeed) * 1000,
                );

                // Cap delay at 100ms to prevent long pauses
                const cappedDelay = Math.min(delay, 100);

                replayState.currentIndex = nextIndex;
                replayState.timeoutId = setTimeout(playNextMessage, cappedDelay);
            } else {
                // No more messages
                replayState.isPlaying = false;
                replayState.currentIndex = nextIndex;
                if (win && win.webContents) {
                    win.webContents.send("replay-status", { isPlaying: false, completed: true });
                }
            }
        };

        // Start the replay loop
        playNextMessage();

        return { ok: true };
    } catch (error) {
        console.error("❌ Failed to start replay:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

// IPC handler to pause replay
ipcMain.handle("pause-replay", async () => {
    try {
        console.log("⏸️ Pausing replay");
        replayState.isPlaying = false;

        if (replayState.timeoutId) {
            clearTimeout(replayState.timeoutId);
            replayState.timeoutId = null;
        }

        return { ok: true };
    } catch (error) {
        console.error("❌ Failed to pause replay:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

// IPC handler to stop replay
ipcMain.handle("stop-replay", async () => {
    try {
        console.log("⏹️ Stopping replay");
        replayState.isPlaying = false;
        replayState.currentIndex = 0;

        if (replayState.timeoutId) {
            clearTimeout(replayState.timeoutId);
            replayState.timeoutId = null;
        }

        return { ok: true };
    } catch (error) {
        console.error("❌ Failed to stop replay:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

// IPC handler to get replay status
ipcMain.handle("get-replay-status", async () => {
    return {
        ok: true,
        isPlaying: replayState.isPlaying,
        currentIndex: replayState.currentIndex,
        totalMessages: replayState.messages.length,
        playbackSpeed: replayState.playbackSpeed,
    };
});

// IPC handler to seek to specific position
ipcMain.handle("seek-replay", async (event, index) => {
    try {
        if (index < 0 || index >= replayState.messages.length) {
            return { ok: false, error: "Invalid index" };
        }

        console.log(`⏭️ Seeking to message ${index}`);
        replayState.currentIndex = index;

        return { ok: true };
    } catch (error) {
        console.error("❌ Failed to seek replay:", error);
        return { ok: false, error: error.message || "Unknown error" };
    }
});

// Handle connect-serial-port with baud rate parameter
ipcMain.on("connect-serial-port", (event, portPath, baudRate) => {
    if (baudRate) {
        connectToPort(portPath, baudRate);
    } else {
        connectToPort(portPath);
    }
});

function attachDebugShortcuts(win) {
    if (!isDebugToolsEnabled) return;

    win.webContents.on("before-input-event", (event, input) => {
        const key = String(input.key || "").toLowerCase();
        const isToggleDevTools =
            (input.control || input.meta) && input.shift && key === "i" && input.type === "keyDown";
        const isReload = (input.control || input.meta) && key === "r" && input.type === "keyDown";

        if (isToggleDevTools) {
            event.preventDefault();
            win.webContents.toggleDevTools();
        }

        if (isReload) {
            event.preventDefault();
            win.webContents.reloadIgnoringCache();
        }
    });
}

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        icon: path.join(__dirname, "../public/logo.jpg"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    if (!app.isPackaged) {
        // Dev mode: load Vite server
        win.loadURL("http://localhost:5173");
    } else {
        // Production mode: load the built React app
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    attachDebugShortcuts(win);

    if (isDebugToolsEnabled) {
        win.webContents.openDevTools({ mode: "detach" });
    }

    win.once("ready-to-show", () => {
        win.maximize();
        win.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    // Create custom menu with baud rate dropdown after window is created
    const menuTemplate = [
        {
            label: "File",
            submenu: [
                {
                    label: "Exit",
                    accelerator: "CmdOrCtrl+Q",
                    click: () => app.quit(),
                },
            ],
        },
        {
            label: "Serial",
            submenu: [
                {
                    label: "Baud Rate",
                    submenu: [
                        {
                            label: "9600",
                            type: "radio",
                            checked: currentBaudRate === 9600,
                            click: () => {
                                currentBaudRate = 9600;
                                if (win && win.webContents) {
                                    win.webContents.send("baud-rate-changed", 9600);
                                }
                            },
                        },
                        {
                            label: "19200",
                            type: "radio",
                            checked: currentBaudRate === 19200,
                            click: () => {
                                currentBaudRate = 19200;
                                if (win && win.webContents) {
                                    win.webContents.send("baud-rate-changed", 19200);
                                }
                            },
                        },
                        {
                            label: "38400",
                            type: "radio",
                            checked: currentBaudRate === 38400,
                            click: () => {
                                currentBaudRate = 38400;
                                if (win && win.webContents) {
                                    win.webContents.send("baud-rate-changed", 38400);
                                }
                            },
                        },
                        {
                            label: "57600",
                            type: "radio",
                            checked: currentBaudRate === 57600,
                            click: () => {
                                currentBaudRate = 57600;
                                if (win && win.webContents) {
                                    win.webContents.send("baud-rate-changed", 57600);
                                }
                            },
                        },
                        {
                            label: "115200",
                            type: "radio",
                            checked: currentBaudRate === 115200,
                            click: () => {
                                currentBaudRate = 115200;
                                if (win && win.webContents) {
                                    win.webContents.send("baud-rate-changed", 115200);
                                }
                            },
                        },
                        {
                            label: "230400",
                            type: "radio",
                            checked: currentBaudRate === 230400,
                            click: () => {
                                currentBaudRate = 230400;
                                if (win && win.webContents) {
                                    win.webContents.send("baud-rate-changed", 230400);
                                }
                            },
                        },
                    ],
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
    stopLiveRecording();
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
