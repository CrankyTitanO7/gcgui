import { useEffect, useRef, useState } from 'react'
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
  { type: 'number',     label: 'Number',         w: 4,  h: 3, defaultName: 'Number Widget',             defaultField: 'speed' },
  { type: 'line-plot',  label: 'Line Plot',       w: 8,  h: 4, defaultName: 'Line Plot Widget',          defaultField: 'speed' },
  { type: 'raw-serial', label: 'Raw Serial',      w: 8,  h: 6, defaultName: 'Raw Serial Widget',         defaultField: '' },
  { type: 'can-data',   label: 'motor inverter',  w: 10, h: 6, defaultName: 'motor inverter CAN Data Widget', defaultField: '' },
  { type: 'bms-status', label: 'BMS Status',      w: 10, h: 8, defaultName: 'BMS Status',                defaultField: '' },
  { type: 'radio',      label: 'Radio',           w: 6,  h: 4, defaultName: 'Radio Widget',              defaultField: '' },
]

const SUPPORTED_TYPES = new Set(COMPONENTS.map((c) => c.type))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

function applyWidgetDefaults(shape) {
  const defaults = COMPONENTS.find((c) => c.type === shape.type)
  if (!defaults) return shape
  return {
    ...shape,
    name:      shape.name      || defaults.defaultName,
    dataField: shape.dataField || defaults.defaultField,
  }
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

function NumberWidget({ shape }) {
  const { canData } = useCANDataHook()
  const [selectedField, setSelectedField] = useState(shape.dataField || 'RPM')

  const allFields = []
  Object.values(canData).forEach((message) => {
    if (message?.fields) {
      Object.keys(message.fields).forEach((field) => {
        if (!allFields.includes(field)) allFields.push(field)
      })
    }
  })

  let currentValue = 'N/A'
  Object.values(canData).forEach((message) => {
    if (message?.fields?.[selectedField] != null) {
      currentValue = message.fields[selectedField]
    }
  })

  const availableFields =
    allFields.length > 0
      ? allFields
      : ['RPM', 'Throttle', 'EngineTemp', 'OilPressure', 'Voltage', 'Current', 'Temperature', 'SOC']

  return (
    <div className="number-widget fill">
      <div className="widget-name">{shape.name || 'Number Widget'}</div>
      <div className="number-widget-value">{currentValue}</div>
      <div className="widget-controls">
        <label
          htmlFor={`field-select-${shape.id}`}
          style={{ fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }}
        >
          Select Field:
        </label>
        <select
          id={`field-select-${shape.id}`}
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: '6px',
            border: '1px solid #444', background: '#2a2a2a', color: '#fff', fontSize: '12px',
          }}
        >
          {availableFields.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function LinePlotWidget({ shape }) {
  const { canData } = useCANDataHook()
  const [selectedField, setSelectedField] = useState(shape.dataField || 'RPM')
  const [dataPoints, setDataPoints] = useState([])

  const allFields = []
  Object.values(canData).forEach((message) => {
    if (message?.fields) {
      Object.keys(message.fields).forEach((field) => {
        if (!allFields.includes(field)) allFields.push(field)
      })
    }
  })

  useEffect(() => {
    let currentValue = null
    Object.values(canData).forEach((message) => {
      if (message?.fields?.[selectedField] != null) {
        currentValue = message.fields[selectedField]
      }
    })
    if (currentValue !== null) {
      setDataPoints((prev) => [...prev, currentValue].slice(-16))
    }
  }, [canData, selectedField])

  const generatePoints = (data) => {
    if (data.length === 0) return ''
    const max = Math.max(...data)
    const min = Math.min(...data)
    return data
      .map((point, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * 100
        const y = max === min ? 50 : 100 - ((point - min) / (max - min)) * 100
        return `${x},${y}`
      })
      .join(' ')
  }

  const generateGridlines = () => {
    const elements = []
    const data = dataPoints.length > 0 ? dataPoints : [0]
    const max = Math.max(...data)
    const min = Math.min(...data)

    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * 100
      elements.push(<line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" className="gridline" />)
    }

    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * 100
      elements.push(<line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} className="gridline" />)
      if (max !== min) {
        const value = min + (max - min) * (1 - i / 10)
        elements.push(
          <text key={`h-label-${i}`} x="2" y={y + 3} className="gridlabel" fontSize="4" fill="#666">
            {Math.round(value)}
          </text>
        )
      } else if (i === 5) {
        elements.push(
          <text key="h-label-center" x="2" y={y + 3} className="gridlabel" fontSize="4" fill="#666">
            {Math.round(max)}
          </text>
        )
      }
    }
    return elements
  }

  const points = generatePoints(dataPoints)
  const currentValue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : 'N/A'
  const label = selectedField ? `${selectedField}:` : 'Value:'

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
        <label
          htmlFor={`line-field-select-${shape.id}`}
          style={{ fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }}
        >
          Select Field:
        </label>
        <select
          id={`line-field-select-${shape.id}`}
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: '6px',
            border: '1px solid #444', background: '#2a2a2a', color: '#fff', fontSize: '12px',
          }}
        >
          {allFields.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      </div>
      <div className="widget-field">{label} {currentValue}</div>
    </div>
  )
}

function renderComponent(shape, runtimeState = {}) {
  switch (shape.type) {
    case 'number':     return <NumberWidget shape={shape} />
    case 'line-plot':  return <LinePlotWidget shape={shape} />
    case 'raw-serial': return <RawSerialWidget isRunning={runtimeState.isRunning} dataSource={runtimeState.dataSource} />
    case 'can-data':   return <CANDataDebugger />
    case 'bms-status': return <BMSStatusWidget shape={shape} />
    case 'radio':      return <RadioWidget />
    default:           return <div className="fallback-block">Unsupported widget</div>
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [shapes, setShapes]               = useState([])
  const [selectedId, setSelectedId]       = useState(null)
  const [panX, setPanX]                   = useState(0)
  const [panY, setPanY]                   = useState(0)
  const [zoom, setZoom]                   = useState(1)
  const [paletteOpen, setPaletteOpen]     = useState(false)
  const [dataSource, setDataSource]       = useState('live')
  const [usbPort, setUsbPort]             = useState('')
  const [baudRate, setBaudRate]           = useState(115200)
  const [availablePorts, setAvailablePorts] = useState([])
  const [isScanning, setIsScanning]       = useState(false)
  const [logFile, setLogFile]             = useState(null)
  const [isRunning, setIsRunning]         = useState(false)
  const [replayInfo, setReplayInfo]       = useState(null)
  const [replayStatus, setReplayStatus]   = useState({ isPlaying: false, completed: false })
  const [layoutLocked, setLayoutLocked]   = useState(false)
  const [contextMenu, setContextMenu]     = useState(null)
  const [propertiesEditor, setPropertiesEditor] = useState({
    open: false, shapeId: null, name: '', dataField: '',
  })

  // Ref used to cancel the replay loop without causing re-renders or stale closures
  const replayCancelRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Serial ports
  // ---------------------------------------------------------------------------

  const refreshPorts = async () => {
    let attempts = 0
    const waitForAPI = () => {
      if (window.electronAPI?.getSerialPorts) return true
      if (++attempts < 50) { setTimeout(waitForAPI, 100); return false }
      console.error('electronAPI not available after 5 seconds')
      return false
    }
    if (!waitForAPI()) return

    setIsScanning(true)
    try {
      const ports = await window.electronAPI.getSerialPorts()
      setAvailablePorts(ports)
      if (ports.length === 1 && !usbPort) setUsbPort(ports[0].path)
    } catch (err) {
      console.error('Failed to refresh ports:', err)
    } finally {
      setIsScanning(false)
    }
  }

  // Scan on mount
  useEffect(() => {
    let attempts = 0
    const waitForAPI = () => {
      if (window.electronAPI?.getSerialPorts) {
        setIsScanning(true)
        window.electronAPI.getSerialPorts()
          .then((ports) => {
            setAvailablePorts(ports)
            if (ports.length === 1 && !usbPort) setUsbPort(ports[0].path)
          })
          .catch((err) => console.error('Failed to scan ports:', err))
          .finally(() => setIsScanning(false))
        return
      }
      if (++attempts < 50) setTimeout(waitForAPI, 100)
      else console.error('electronAPI not available after 5 seconds')
    }
    waitForAPI()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Connect / disconnect serial port when selection changes
  useEffect(() => {
    if (usbPort && window.electronAPI?.connectSerialPort) {
      window.electronAPI.connectSerialPort(usbPort, baudRate)
    } else if (!usbPort && window.electronAPI?.disconnectSerialPort) {
      window.electronAPI.disconnectSerialPort()
    }
  }, [usbPort, baudRate])

  // Handle baud rate changes from native menu
  useEffect(() => {
    const ipc = window.electron?.ipcRenderer
    if (!ipc) return
    const handler = (_event, newRate) => {
      if (usbPort) ipc.send('set-baud-rate', newRate)
    }
    ipc.on('baud-rate-changed', handler)
    return () => ipc.off('baud-rate-changed', handler)
  }, [usbPort])

  // ---------------------------------------------------------------------------
  // Live recording
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.startLiveRecording || !api?.stopLiveRecording) return

    const shouldRecord = dataSource === 'live' && isRunning && Boolean(usbPort?.trim())

    if (shouldRecord) {
      api.startLiveRecording()
        .then((result) => { if (!result?.ok) console.error('Failed to start live recording:', result?.error) })
        .catch((err) => console.error('Failed to start live recording:', err))
    } else {
      api.stopLiveRecording().catch((err) => console.error('Failed to stop live recording:', err))
    }
  }, [dataSource, isRunning, usbPort])

  // Stop recording on unmount
  useEffect(() => {
    return () => {
      window.electronAPI?.stopLiveRecording?.()
        .catch((err) => console.error('Failed to stop live recording on cleanup:', err))
    }
  }, [])

  // ---------------------------------------------------------------------------
  // CRTD file loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!logFile || dataSource !== 'log') {
      setReplayInfo(null)
      return
    }

    const loadFile = async () => {
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = (e) => resolve(e.target.result)
          reader.onerror = ()  => reject(new Error('Failed to read file'))
          reader.readAsText(logFile)
        })

        const lines = content.split('\n').filter((l) => l.trim())
        if (lines.length === 0) { console.error('Empty file'); return }

        const headerLine = lines[0]
        const header = headerLine.startsWith('CXXRTL')
          ? { raw: headerLine, timestamp: headerLine.replace('CXXRTL BDR-Pitwall live capture ', '') }
          : null

        const messages = []

        for (let i = 1; i < lines.length; i++) {
          const line  = lines[i].trim()
          if (!line) continue

          const parts = line.split(/\s+/)
          if (parts.length < 3) continue

          const timestamp = parseFloat(parts[0])
          if (isNaN(timestamp)) continue

          let canId = parts[1]
          let direction = 'R'
          if (canId.startsWith('R') || canId.startsWith('T')) {
            direction = canId[0]
            canId = canId.substring(1)
          }

          const dataBytes = []
          for (let j = 2; j < parts.length; j++) {
            const byte = parseInt(parts[j], 16)
            if (!isNaN(byte)) dataBytes.push(byte)
          }
          if (dataBytes.length === 0) continue

          const canIdNum      = parseInt(canId, 16)
          const formattedCanId = '0x' + canIdNum.toString(16).toLowerCase()

          messages.push({ timestamp, direction, canId: formattedCanId, canIdRaw: canId, dataBytes, raw: line })
        }

        console.log(`✅ Parsed ${messages.length} messages from CRTD file`)

        setReplayInfo({
          header,
          messages,
          messageCount: messages.length,
          duration: messages.length > 0 ? messages[messages.length - 1].timestamp : 0,
        })
        setReplayStatus({ isPlaying: false, completed: false })

      } catch (err) {
        console.error('❌ Failed to load CRTD file:', err)
        setReplayInfo(null)
      }
    }

    loadFile()
  }, [logFile, dataSource])

  // ---------------------------------------------------------------------------
  // Replay — fixed:
  //   1. replayCancelRef instead of replayStatus in deps (no stale-closure/loop-kill)
  //   2. Pause works by flipping the ref; no in-flight timeouts survive
  //   3. Only [isRunning, dataSource, replayInfo] in the dep array
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (dataSource !== 'log' || !replayInfo) return

    if (isRunning) {
      // Cancel any previous loop that may still be winding down
      replayCancelRef.current = false
      setReplayStatus({ isPlaying: true, completed: false })

      let currentIndex = 0

      const playNextMessage = () => {
        // Each step checks the ref — works even inside closures
        if (replayCancelRef.current) return

        if (currentIndex >= replayInfo.messages.length) {
          console.log('✅ Replay completed')
          setReplayStatus({ isPlaying: false, completed: true })
          setIsRunning(false)
          return
        }

        const message = replayInfo.messages[currentIndex]

        if (window.electronAPI?.injectSerialData) {
          const dataHex = message.dataBytes
            .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
            .join(' ')
          window.electronAPI.injectSerialData(
            `${message.timestamp} ${message.direction}${message.canIdRaw} ${dataHex}`
          )
        }

        currentIndex++

        if (currentIndex < replayInfo.messages.length) {
          const delay = Math.min(
            (replayInfo.messages[currentIndex].timestamp - message.timestamp) * 1000,
            100
          )
          setTimeout(playNextMessage, delay)
        } else {
          setReplayStatus({ isPlaying: false, completed: true })
          setIsRunning(false)
        }
      }

      playNextMessage()

      return () => {
        // Fires when isRunning flips to false OR dependencies change
        replayCancelRef.current = true
        setReplayStatus((prev) => ({ ...prev, isPlaying: false }))
      }
    }
    // If !isRunning just make sure the loop is cancelled (e.g. external pause)
    replayCancelRef.current = true
    setReplayStatus((prev) => ({ ...prev, isPlaying: false }))

  }, [isRunning, dataSource, replayInfo]) // ← replayStatus deliberately excluded

  // Listen for replay status from main process
  useEffect(() => {
    if (!window.electronAPI?.onReplayStatus) return
    return window.electronAPI.onReplayStatus((status) => {
      setReplayStatus(status)
      if (status.completed) setIsRunning(false)
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Context-menu auto-close
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click',  close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click',  close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key    = event.key.toLowerCase()
      const typing = isTypingTarget(event.target)

      if (event.key === 'Escape') {
        if (propertiesEditor.open) { event.preventDefault(); closePropertiesEditor(); return }
        if (paletteOpen)           { event.preventDefault(); setPaletteOpen(false);   return }
        if (contextMenu)           { setContextMenu(null) }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, propertiesEditor.open, paletteOpen, contextMenu, layoutLocked, shapes])

  // ---------------------------------------------------------------------------
  // Shape management
  // ---------------------------------------------------------------------------

  function addShape(component) {
    if (layoutLocked) return
    const id = Date.now()
    setShapes((s) => [
      ...s,
      {
        id,
        type:      component.type,
        x:         0,
        y:         0,
        width:     component.w * GRID_SIZE,
        height:    component.h * GRID_SIZE,
        name:      component.defaultName,
        dataField: component.defaultField,
      },
    ])
    setSelectedId(id)
  }

  function onUpdateShape(id, patch) {
    if (layoutLocked) return
    setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function deleteShape(id) {
    if (layoutLocked || !id) return
    setShapes((arr) => arr.filter((s) => s.id !== id))
    setContextMenu((menu) => (menu?.shapeId === id ? null : menu))
    setPropertiesEditor((curr) =>
      curr.shapeId === id ? { open: false, shapeId: null, name: '', dataField: '' } : curr
    )
    setSelectedId((curr) => (curr === id ? null : curr))
  }

  function openPropertiesEditor(shapeId) {
    const shape = shapes.find((s) => s.id === shapeId)
    if (!shape || layoutLocked) return
    setPropertiesEditor({ open: true, shapeId, name: shape.name || '', dataField: shape.dataField || '' })
  }

  function closePropertiesEditor() {
    setPropertiesEditor({ open: false, shapeId: null, name: '', dataField: '' })
  }

  function applyPropertiesEditorChanges() {
    if (layoutLocked || !propertiesEditor.shapeId) return
    onUpdateShape(propertiesEditor.shapeId, {
      name:      propertiesEditor.name.trim()      || 'Widget',
      dataField: propertiesEditor.dataField.trim() || 'speed',
    })
    closePropertiesEditor()
  }

  // ---------------------------------------------------------------------------
  // Config persistence
  // ---------------------------------------------------------------------------

  function saveConfiguration() {
    saveConfig(createConfig(shapes, panX, panY, zoom), 'pitwall-config')
  }

  function loadConfiguration(file) {
    loadConfig(file)
      .then((loaded) => {
        const validated = validateConfig(loaded)
        const supported = validated.shapes
          .filter((s) => SUPPORTED_TYPES.has(s.type))
          .map(applyWidgetDefaults)

        setShapes(supported)
        setPanX(validated.view.panX)
        setPanY(validated.view.panY)
        setZoom(validated.view.zoom)
        setSelectedId(null)
        setContextMenu(null)
        closePropertiesEditor()
      })
      .catch((err) => {
        console.error('Failed to load configuration:', err)
        alert('Failed to load configuration file. Please check the file format.')
      })
  }

  function resetConfiguration() {
    if (layoutLocked) return
    const def = getDefaultConfig()
    setShapes(def.shapes)
    setPanX(def.view.panX)
    setPanY(def.view.panY)
    setZoom(def.view.zoom)
    setSelectedId(null)
    setContextMenu(null)
    closePropertiesEditor()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <InfoProcProvider isRunning={isRunning} dataSource={dataSource}>
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
          onOpenShapeMenu={({ id, x, y }) => setContextMenu({ shapeId: id, x, y })}
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
          onDelete={() => deleteShape(selectedId)}
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
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="widget-context-option"
              disabled={layoutLocked}
              onClick={() => {
                openPropertiesEditor(contextMenu.shapeId)
                setContextMenu(null)
              }}
            >
              Edit
            </button>
            <button
              className="widget-context-option danger"
              disabled={layoutLocked}
              onClick={() => {
                deleteShape(contextMenu.shapeId)
                setContextMenu(null)
              }}
            >
              Delete
            </button>
          </div>
        )}

        {propertiesEditor.open && (
          <div className="properties-overlay" onClick={closePropertiesEditor}>
            <div className="properties-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Widget Properties</h3>
              <form
                className="properties-form"
                onSubmit={(e) => { e.preventDefault(); applyPropertiesEditorChanges() }}
              >
                <label htmlFor="widget-name">Name</label>
                <input
                  id="widget-name"
                  type="text"
                  value={propertiesEditor.name}
                  placeholder="Widget name"
                  onChange={(e) =>
                    setPropertiesEditor((curr) => ({ ...curr, name: e.target.value }))
                  }
                />

                <label htmlFor="widget-data-field">Data Field</label>
                <input
                  id="widget-data-field"
                  type="text"
                  value={propertiesEditor.dataField}
                  placeholder="Data field"
                  onChange={(e) =>
                    setPropertiesEditor((curr) => ({ ...curr, dataField: e.target.value }))
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
    </InfoProcProvider>
  )
}

export default App