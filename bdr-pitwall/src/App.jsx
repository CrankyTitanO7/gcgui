import { useEffect, useState } from 'react'
import './App.css'
import Editor from './components/Editor'
import Palette from './components/Palette'
import ControlBar from './components/ControlBar'
import RawSerialWidget from './components/RawSerialWidget'
import { InfoProcProvider, CANDataDebugger, useCANDataHook } from './components/infoProc'
import { saveConfig, loadConfig, createConfig, validateConfig, getDefaultConfig } from './utils/config'

const GRID_SIZE = 28

const COMPONENTS = [
  { type: 'number', label: 'Number', w: 4, h: 3, defaultName: 'Number Widget', defaultField: 'speed' },
  { type: 'line-plot', label: 'Line Plot', w: 8, h: 4, defaultName: 'Line Plot Widget', defaultField: 'speed' },
  { type: 'raw-serial', label: 'Raw Serial', w: 8, h: 6, defaultName: 'Raw Serial Widget', defaultField: '' },
  { type: 'can-data', label: 'CAN Data', w: 10, h: 6, defaultName: 'CAN Data Widget', defaultField: '' },
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

function renderComponent(shape) {
  switch (shape.type) {
    case 'number': {
      return <NumberWidget shape={shape} />;
    }
    case 'line-plot': {
      const data = getSeriesFromField(shape.dataField)
      const max = Math.max(...data)
      const min = Math.min(...data)
      const points = data
        .map((point, index) => {
          const x = (index / Math.max(data.length - 1, 1)) * 100
          const y = max === min ? 50 : 100 - ((point - min) / (max - min)) * 100
          return `${x},${y}`
        })
        .join(' ')

      return (
        <div className="line-widget fill">
          <div className="widget-name">{shape.name || 'Line Plot Widget'}</div>
          <div className="line-widget-canvas">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-plot-svg">
              <polyline points={points} className="line-plot-path" />
            </svg>
          </div>
          <div className="widget-field">Field: {shape.dataField || 'speed'}</div>
        </div>
      )
    }
    case 'raw-serial': {
      return (
        <RawSerialWidget />
      )
    }
    case 'can-data': {
      return (
        <CANDataDebugger />
      )
    }
    default:
      return <div className="fallback-block">Unsupported widget</div>
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

  return (
    <InfoProcProvider>
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
          renderShape={(shape) => renderComponent(shape)}
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
