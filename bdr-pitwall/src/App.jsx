import { useEffect, useState } from 'react'
import './App.css'
import BMSStatusWidget from './components/BMS'
import ControlBar from './components/ControlBar'
import Editor from './components/Editor'
import Palette from './components/Palette'
import RadioWidget from './components/RadioWidget'
import RawSerialWidget from './components/RawSerialWidget'
import { CANDataDebugger, InfoProcProvider, useCANDataHook } from './components/infoProc'
import { createConfig, getDefaultConfig, loadConfig, saveConfig, validateConfig } from './utils/config'

const GRID_SIZE = 28

const COMPONENTS = [
  { type: 'number', label: 'Number', w: 4, h: 3, defaultName: 'Number Widget', defaultField: 'speed' },
  { type: 'line-plot', label: 'Line Plot', w: 8, h: 4, defaultName: 'Line Plot Widget', defaultField: 'speed' },
  { type: 'raw-serial', label: 'Raw Serial', w: 8, h: 6, defaultName: 'Raw Serial Widget', defaultField: '' },
  { type: 'can-data', label: 'motor inverter', w: 10, h: 6, defaultName: 'motor inverter CAN Data Widget', defaultField: '' },
  { type: 'bms-status', label: 'BMS Status', w: 10, h: 8, defaultName: 'BMS Status', defaultField: '' },
  { type: 'radio', label: 'Radio', w: 6, h: 4, defaultName: 'Radio Widget', defaultField: '' },
]

const SUPPORTED_TYPES = new Set(COMPONENTS.map((component) => component.type))

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

function getSeriesFromField(field, points = 16) {
  const source = (field || 'value').trim()
  const seed = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1
  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin((index + seed / 8) * 0.65) * 18
    const variance = ((seed * (index + 3)) % 17) - 8
    return 50 + wave + variance
  })
}

function NumberWidget({ shape }) {
  const { canData } = useCANDataHook();
  const [selectedField, setSelectedField] = useState(shape.dataField || 'RPM');

  // Debug logging
  console.log('NumberWidget render - canData:', canData);
  console.log('NumberWidget render - selectedField:', selectedField);

  // Get all available fields from all CAN messages
  const allFields = [];
  Object.values(canData).forEach(message => {
    console.log('Processing message:', message);
    if (message && message.fields) {
      Object.keys(message.fields).forEach(field => {
        console.log('Found field:', field, 'value:', message.fields[field]);
        if (!allFields.includes(field)) {
          allFields.push(field);
        }
      });
    }
  });

  // Get current value for selected field
  let currentValue = 'N/A';
  Object.values(canData).forEach(message => {
    if (message && message.fields && message.fields[selectedField] !== null && message.fields[selectedField] !== undefined) {
      currentValue = message.fields[selectedField];
      console.log('Found value for', selectedField, ':', currentValue);
    }
  });

  // If no fields available, use a default set
  const availableFields = allFields.length > 0 ? allFields : ['RPM', 'Throttle', 'EngineTemp', 'OilPressure', 'Voltage', 'Current', 'Temperature', 'SOC'];

  return (
    <div className="number-widget fill">
      <div className="widget-name">{shape.name || 'Number Widget'}</div>
      <div className="number-widget-value">{currentValue}</div>
      <div className="widget-controls">
        <label htmlFor={`field-select-${shape.id}`} style={{ fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }}>
          Select Field:
        </label>
        <select
          id={`field-select-${shape.id}`}
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid #444',
            background: '#2a2a2a',
            color: '#fff',
            fontSize: '12px'
          }}
        >
          {availableFields.map(field => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LinePlotWidget({ shape }) {
  const { canData } = useCANDataHook();
  const [selectedField, setSelectedField] = useState(shape.dataField || 'RPM');
  const [dataPoints, setDataPoints] = useState([]);

  // Get all available fields from all CAN messages
  const allFields = [];
  Object.values(canData).forEach(message => {
    if (message && message.fields) {
      Object.keys(message.fields).forEach(field => {
        if (!allFields.includes(field)) {
          allFields.push(field);
        }
      });
    }
  });

  // Update data points when new CAN data arrives
  useEffect(() => {
    let currentValue = null;
    
    // Find current value for selected field
    Object.values(canData).forEach(message => {
      if (message && message.fields && message.fields[selectedField] !== null && message.fields[selectedField] !== undefined) {
        currentValue = message.fields[selectedField];
      }
    });

    if (currentValue !== null) {
      setDataPoints(prev => {
        const newData = [...prev, currentValue];
        // Keep only last 16 points
        return newData.slice(-16);
      });
    }
  }, [canData, selectedField]);

  // Generate SVG points for the line plot
  const generatePoints = (data) => {
    if (data.length === 0) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const points = data
      .map((point, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * 100
        const y = max === min ? 50 : 100 - ((point - min) / (max - min)) * 100
        return `${x},${y}`
      })
      .join(' ')
    
    return points;
  };

  // Generate gridlines with labels
  const generateGridlines = () => {
    const elements = [];
    const data = dataPoints.length > 0 ? dataPoints : [0];
    const max = Math.max(...data);
    const min = Math.min(...data);
    
    // Vertical gridlines (time axis) - no labels
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * 100;
      elements.push(<line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" className="gridline" />);
    }
    
    // Horizontal gridlines (value axis) with small labels
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * 100;
      elements.push(<line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} className="gridline" />);
      
      // Add value labels on left side
      if (max !== min) {
        const value = min + (max - min) * (1 - i / 10);
        elements.push(
          <text 
            key={`h-label-${i}`} 
            x="2" 
            y={y + 3} 
            className="gridlabel"
            fontSize="4"
            fill="#666"
          >
            {Math.round(value)}
          </text>
        );
      } else if (i === 5) {
        // If all values are the same, show the value in the middle
        elements.push(
          <text 
            key={`h-label-center`} 
            x="2" 
            y={y + 3} 
            className="gridlabel"
            fontSize="4"
            fill="#666"
          >
            {Math.round(max)}
          </text>
        );
      }
    }
    return elements;
  };

  const points = generatePoints(dataPoints);
  const currentValue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : 'N/A';
  const label = selectedField ? `${selectedField}:` : 'Value:';

  return (
    <div className="line-widget fill">
      <div className="widget-name">{shape.name || 'Line Plot Widget'}</div>
      <div className="line-widget-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-plot-svg">
          {generateGridlines()}
          <polyline points={points} className="line-plot-path" />
        </svg>
      </div>
      <div className="widget-controls">
        <label htmlFor={`line-field-select-${shape.id}`} style={{ fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }}>
          Select Field:
        </label>
        <select
          id={`line-field-select-${shape.id}`}
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid #444',
            background: '#2a2a2a',
            color: '#fff',
            fontSize: '12px'
          }}
        >
          {allFields.map(field => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      </div>
      <div className="widget-field">{label} {currentValue}</div>
    </div>
  );
}

function renderComponent(shape, runtimeState = {}) {
  switch (shape.type) {
    case 'number':     return <NumberWidget shape={shape} />;
    case 'line-plot':  return <LinePlotWidget shape={shape} />;
    case 'raw-serial': return <RawSerialWidget
          isRunning={runtimeState.isRunning}
          dataSource={runtimeState.dataSource}
        />;
    case 'can-data':   return <CANDataDebugger />;
    case 'bms-status': return <BMSStatusWidget shape={shape} />;
    case 'radio': {
      return (
        <RadioWidget />
      )
    }
    default:           return <div className="fallback-block">Unsupported widget</div>;
  }
}

function applyWidgetDefaults(shape) {
  const defaults = COMPONENTS.find((component) => component.type === shape.type)
  if (!defaults) return shape
  return {
    ...shape,
    name: shape.name || defaults.defaultName,
    dataField: shape.dataField || defaults.defaultField,
  }
}

function App() {
  const [shapes, setShapes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dataSource, setDataSource] = useState('live')
  const [usbPort, setUsbPort] = useState('')
  const [baudRate, setBaudRate] = useState(115200)
  const [availablePorts, setAvailablePorts] = useState([])
  const [isScanning, setIsScanning] = useState(false)

  // Function to refresh available ports
  const refreshPorts = async () => {
    console.log('Refreshing ports...');
    // Wait for electronAPI to be available
    let attempts = 0
    const maxAttempts = 50 // Wait up to 5 seconds
    const checkAvailability = () => {
      if (window.electronAPI && window.electronAPI.getSerialPorts) {
        console.log('electronAPI is available, proceeding with port refresh');
        return true
      } else {
        attempts++
        if (attempts < maxAttempts) {
          console.log(`electronAPI not ready, attempt ${attempts}/${maxAttempts}`)
          setTimeout(checkAvailability, 100) // Check every 100ms
          return false
        } else {
          console.error('electronAPI not available after 5 seconds')
          return false
        }
      }
    }

    if (!checkAvailability()) return

    setIsScanning(true)
    try {
      console.log('Calling getSerialPorts from refresh...');
      const ports = await window.electronAPI.getSerialPorts()
      console.log('Received ports from refresh:', ports);
      setAvailablePorts(ports)
      // If there's only one port available and no port is currently selected, auto-select it
      if (ports.length === 1 && !usbPort) {
        setUsbPort(ports[0].path)
      }
    } catch (error) {
      console.error('Failed to refresh ports:', error)
    } finally {
      setIsScanning(false)
    }
  }
  const [logFile, setLogFile] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [replayInfo, setReplayInfo] = useState(null)
  const [replayStatus, setReplayStatus] = useState({ isPlaying: false, completed: false })
  const [layoutLocked, setLayoutLocked] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [propertiesEditor, setPropertiesEditor] = useState({
    open: false,
    shapeId: null,
    name: '',
    dataField: '',
  })

  function addShape(component) {
    if (layoutLocked) return
    const id = Date.now()
    const width = component.w * GRID_SIZE
    const height = component.h * GRID_SIZE
    const newShape = {
      id,
      type: component.type,
      x: 0,
      y: 0,
      width,
      height,
      name: component.defaultName,
      dataField: component.defaultField,
    }
    setShapes((s) => [...s, newShape])
    setSelectedId(id)
  }

  function onUpdateShape(id, patch) {
    if (layoutLocked) return
    setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function deleteShape(id) {
    if (layoutLocked || !id) return
    setShapes((arr) => arr.filter((shape) => shape.id !== id))
    setContextMenu((menu) => (menu?.shapeId === id ? null : menu))
    setPropertiesEditor((current) =>
      current.shapeId === id
        ? {
            open: false,
            shapeId: null,
            name: '',
            dataField: '',
          }
        : current
    )
    setSelectedId((current) => (current === id ? null : current))
  }

  function openPropertiesEditor(shapeId) {
    const shape = shapes.find((item) => item.id === shapeId)
    if (!shape || layoutLocked) return

    setPropertiesEditor({
      open: true,
      shapeId,
      name: shape.name || '',
      dataField: shape.dataField || '',
    })
  }

  function closePropertiesEditor() {
    setPropertiesEditor({
      open: false,
      shapeId: null,
      name: '',
      dataField: '',
    })
  }

  function applyPropertiesEditorChanges() {
    if (layoutLocked || !propertiesEditor.shapeId) return
    const cleanName = propertiesEditor.name.trim()
    const cleanDataField = propertiesEditor.dataField.trim()

    onUpdateShape(propertiesEditor.shapeId, {
      name: cleanName || 'Widget',
      dataField: cleanDataField || 'speed',
    })
    closePropertiesEditor()
  }

  function deleteSelected() {
    deleteShape(selectedId)
  }

  // Save current configuration
  function saveConfiguration() {
    const config = createConfig(shapes, panX, panY, zoom)
    saveConfig(config, 'pitwall-config')
  }

  // Load configuration from file
  function loadConfiguration(file) {
    loadConfig(file)
      .then((loadedConfig) => {
        const validatedConfig = validateConfig(loadedConfig)
        const supportedShapes = validatedConfig.shapes
          .filter((shape) => SUPPORTED_TYPES.has(shape.type))
          .map((shape) => applyWidgetDefaults(shape))

        setShapes(supportedShapes)
        setPanX(validatedConfig.view.panX)
        setPanY(validatedConfig.view.panY)
        setZoom(validatedConfig.view.zoom)
        setSelectedId(null)
        setContextMenu(null)
        closePropertiesEditor()
      })
      .catch((error) => {
        console.error('Failed to load configuration:', error)
        alert('Failed to load configuration file. Please check the file format.')
      })
  }

  // Reset to default configuration
  function resetConfiguration() {
    if (layoutLocked) return
    const defaultConfig = getDefaultConfig()
    setShapes(defaultConfig.shapes)
    setPanX(defaultConfig.view.panX)
    setPanY(defaultConfig.view.panY)
    setZoom(defaultConfig.view.zoom)
    setSelectedId(null)
    setContextMenu(null)
    closePropertiesEditor()
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const typing = isTypingTarget(event.target)

      if (event.key === 'Escape') {
        if (propertiesEditor.open) {
          event.preventDefault()
          closePropertiesEditor()
          return
        }
        if (paletteOpen) {
          event.preventDefault()
          setPaletteOpen(false)
          return
        }
        if (contextMenu) {
          setContextMenu(null)
        }
        return
      }

      if (key === 'e' && selectedId && !typing && !propertiesEditor.open && !layoutLocked) {
        event.preventDefault()
        openPropertiesEditor(selectedId)
        return
      }

      if (event.key === 'Delete' && selectedId && !typing) {
        event.preventDefault()
        deleteShape(selectedId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, propertiesEditor.open, paletteOpen, contextMenu, layoutLocked, shapes])

  // Scan for available serial ports when the app starts
  useEffect(() => {
    const scanPorts = async () => {
      console.log('Starting port scan...');
      // Wait for electronAPI to be available
      let attempts = 0
      const maxAttempts = 50 // Wait up to 5 seconds
      const checkAvailability = () => {
        if (window.electronAPI && window.electronAPI.getSerialPorts) {
          console.log('electronAPI is available, proceeding with port scan');
          return true
        } else {
          attempts++
          if (attempts < maxAttempts) {
            console.log(`electronAPI not ready, attempt ${attempts}/${maxAttempts}`)
            setTimeout(checkAvailability, 100) // Check every 100ms
            return false
          } else {
            console.error('electronAPI not available after 5 seconds')
            return false
          }
        }
      }

      if (!checkAvailability()) return

      setIsScanning(true)
      try {
        console.log('Calling getSerialPorts...');
        const ports = await window.electronAPI.getSerialPorts()
        console.log('Received ports from main process:', ports);
        setAvailablePorts(ports)
        // If there's only one port available, auto-select it
        if (ports.length === 1 && !usbPort) {
          setUsbPort(ports[0].path)
        }
      } catch (error) {
        console.error('Failed to scan for serial ports:', error)
      } finally {
        setIsScanning(false)
      }
    }

    scanPorts()
  }, [])

  // Handle USB port and baud rate changes
  useEffect(() => {
    if (usbPort && window.electronAPI && window.electronAPI.connectSerialPort) {
      window.electronAPI.connectSerialPort(usbPort, baudRate)
    } else if (!usbPort && window.electronAPI && window.electronAPI.disconnectSerialPort) {
      window.electronAPI.disconnectSerialPort()
    }
  }, [usbPort, baudRate])

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.startLiveRecording || !window.electronAPI.stopLiveRecording) {
      return
    }

    const shouldRecord = dataSource === 'live' && isRunning && Boolean(usbPort && usbPort.trim())

    if (shouldRecord) {
      window.electronAPI
        .startLiveRecording()
        .then((result) => {
          if (!result?.ok) {
            console.error('Failed to start live recording:', result?.error)
            return
          }
          console.log('Live recording file:', result.filePath)
        })
        .catch((error) => {
          console.error('Failed to start live recording:', error)
        })
      return
    }

    window.electronAPI.stopLiveRecording().catch((error) => {
      console.error('Failed to stop live recording:', error)
    })
  }, [dataSource, isRunning, usbPort])

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.stopLiveRecording) {
      return undefined
    }

    return () => {
      window.electronAPI.stopLiveRecording().catch((error) => {
        console.error('Failed to stop live recording on cleanup:', error)
      })
    }
  }, [])

  // Handle baud rate changes from menu
  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      const handleBaudRateChanged = (event, baudRate) => {
        console.log('Baud rate changed to:', baudRate);
        // If currently connected, reconnect with new baud rate
        if (usbPort) {
          window.electron.ipcRenderer.send('set-baud-rate', baudRate);
        }
      };

      window.electron.ipcRenderer.on('baud-rate-changed', handleBaudRateChanged);

      return () => {
        window.electron.ipcRenderer.off('baud-rate-changed', handleBaudRateChanged);
      };
    }
  }, [usbPort]);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null)
    window.addEventListener('click', closeContextMenu)
    window.addEventListener('scroll', closeContextMenu, true)
    window.addEventListener('resize', closeContextMenu)
    return () => {
      window.removeEventListener('click', closeContextMenu)
      window.removeEventListener('scroll', closeContextMenu, true)
      window.removeEventListener('resize', closeContextMenu)
    }
  }, [])

  // Load CRTD file when logFile changes
  useEffect(() => {
    if (!logFile || dataSource !== 'log') {
      setReplayInfo(null);
      return;
    }

    const loadFile = async () => {
      try {
        console.log('📂 Loading CRTD file:', logFile.name);
        
        // Read file content
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(logFile);
        });

        // Parse the file content
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          console.error('Empty file');
          return;
        }

        // Parse header
        const headerLine = lines[0];
        let header = null;
        
        if (headerLine.startsWith('CXXRTL')) {
          header = {
            raw: headerLine,
            timestamp: headerLine.replace('CXXRTL BDR-Pitwall live capture ', '')
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
          let direction = 'R'; // Default to Received
          
          if (canId.startsWith('R') || canId.startsWith('T')) {
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
          const formattedCanId = '0x' + canIdNum.toString(16).toLowerCase();

          messages.push({
            timestamp,
            direction,
            canId: formattedCanId,
            canIdRaw: canId,
            dataBytes,
            raw: line
          });
        }

        console.log(`✅ Parsed ${messages.length} messages from CRTD file`);
        
        setReplayInfo({
          header,
          messages,
          messageCount: messages.length,
          duration: messages.length > 0 ? messages[messages.length - 1].timestamp : 0
        });

        setReplayStatus({ isPlaying: false, completed: false });

      } catch (error) {
        console.error('❌ Failed to load CRTD file:', error);
        setReplayInfo(null);
      }
    };

    loadFile();
  }, [logFile, dataSource]);

  // Handle replay when isRunning changes
  useEffect(() => {
    if (dataSource !== 'log' || !replayInfo) {
      return;
    }

    if (isRunning && !replayStatus.isPlaying) {
      // Start replay
      console.log('▶️ Starting replay');
      
      setReplayStatus({ isPlaying: true, completed: false });
      
      let currentIndex = 0;
      let timeoutId = null;

      const playNextMessage = () => {
        if (!replayStatus.isPlaying && currentIndex === 0) {
          // First message, mark as playing
          setReplayStatus({ isPlaying: true, completed: false });
        }

        if (currentIndex >= replayInfo.messages.length) {
          console.log('✅ Replay completed');
          setReplayStatus({ isPlaying: false, completed: true });
          setIsRunning(false);
          return;
        }

        const message = replayInfo.messages[currentIndex];
        
        // Send message to serial data handler
        if (window.electronAPI && window.electronAPI.onSerialData) {
          // Format as serial data string (same format as live data)
          const dataHex = message.dataBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
          const serialLine = `${message.timestamp} ${message.direction}${message.canIdRaw} ${dataHex}`;
          
          // Trigger the serial-data event
          const event = new CustomEvent('serial-data', { detail: serialLine });
          window.dispatchEvent(event);
        }

        currentIndex++;

        // Calculate delay to next message
        if (currentIndex < replayInfo.messages.length) {
          const nextMessage = replayInfo.messages[currentIndex];
          const delay = (nextMessage.timestamp - message.timestamp) * 1000;
          
          // Cap delay at 100ms to prevent long pauses
          const cappedDelay = Math.min(delay, 100);
          
          timeoutId = setTimeout(playNextMessage, cappedDelay);
        } else {
          // No more messages
          setReplayStatus({ isPlaying: false, completed: true });
          setIsRunning(false);
        }
      };

      // Start the replay loop
      playNextMessage();

      // Cleanup function
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    } else if (!isRunning && replayStatus.isPlaying) {
      // Pause replay
      console.log('⏸️ Pausing replay');
      setReplayStatus(prev => ({ ...prev, isPlaying: false }));
    }
  }, [isRunning, dataSource, replayInfo, replayStatus.isPlaying]);

  // Listen for replay status updates
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onReplayStatus) {
      return;
    }

    const cleanup = window.electronAPI.onReplayStatus((status) => {
      console.log('Replay status update:', status);
      setReplayStatus(status);
      
      if (status.completed) {
        setIsRunning(false);
      }
    });

    return cleanup;
  }, []);

  return (
    <InfoProcProvider isRunning={isRunning}>
      <div className="app-shell" onClick={() => setContextMenu(null)}>
        <ControlBar
          dataSource={dataSource}
          setDataSource={setDataSource}
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
        />
        <Editor
          shapes={shapes}
          onUpdateShape={onUpdateShape}
          onSelectShape={setSelectedId}
          onOpenShapeMenu={({ id, x, y }) => {
            setContextMenu({ shapeId: id, x, y })
          }}
          selectedId={selectedId}
          panX={panX}
          setPanX={setPanX}
          panY={panY}
          setPanY={setPanY}
          gridSize={GRID_SIZE}
          zoom={zoom}
          setZoom={setZoom}
          renderShape={(shape) => renderComponent(shape, { isRunning, dataSource })}
        />
        <Palette
          components={COMPONENTS}
          onAdd={addShape}
          onDelete={deleteSelected}
          onSave={saveConfiguration}
          onLoad={loadConfiguration}
          onReset={resetConfiguration}
          hasSelection={Boolean(selectedId)}
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          isLocked={layoutLocked}
          onToggleLayoutLock={() => setLayoutLocked((v) => !v)}
        />


        {contextMenu && (
          <div
            className="widget-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="widget-context-option"
              onClick={() => {
                openPropertiesEditor(contextMenu.shapeId)
                setContextMenu(null)
              }}
              disabled={layoutLocked}
            >
              Edit
            </button>
            <button
              className="widget-context-option danger"
              onClick={() => {
                deleteShape(contextMenu.shapeId)
                setContextMenu(null)
              }}
              disabled={layoutLocked}
            >
              Delete
            </button>
          </div>
        )}

        {propertiesEditor.open && (
          <div className="properties-overlay" onClick={closePropertiesEditor}>
            <div className="properties-modal" onClick={(event) => event.stopPropagation()}>
              <h3>Widget Properties</h3>
              <form
                className="properties-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  applyPropertiesEditorChanges()
                }}
              >
                <label htmlFor="widget-name">Name</label>
                <input
                  id="widget-name"
                  type="text"
                  value={propertiesEditor.name}
                  onChange={(event) =>
                    setPropertiesEditor((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Widget name"
                />

                <label htmlFor="widget-data-field">Data Field</label>
                <input
                  id="widget-data-field"
                  type="text"
                  value={propertiesEditor.dataField}
                  onChange={(event) =>
                    setPropertiesEditor((current) => ({
                      ...current,
                      dataField: event.target.value,
                    }))
                  }
                  placeholder="Data field"
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
    </InfoProcProvider>
  )
}

export default App
