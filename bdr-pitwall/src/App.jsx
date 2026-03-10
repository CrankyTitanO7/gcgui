import { useEffect, useState } from 'react'
import './App.css'
import Editor from './components/Editor'
import Palette from './components/Palette'
import ControlBar from './components/ControlBar'
import { saveConfig, loadConfig, createConfig, validateConfig, getDefaultConfig } from './utils/config'

const GRID_SIZE = 28

const COMPONENTS = [
  { type: 'frame-grid', label: 'Frame Grid', w: 16, h: 10 },
  { type: 'media', label: 'Track Media', w: 7, h: 6 },
  { type: 'weather', label: 'Weather', w: 4, h: 3 },
  { type: 'metric-duo', label: 'Metric Duo', w: 6, h: 3 },
  { type: 'sparkline-panel', label: 'Frame 2 Panel', w: 10, h: 4 },
  { type: 'frame-four', label: 'Frame 4 List', w: 6, h: 3 },
  { type: 'pill', label: 'Pill', w: 2, h: 1 },
  { type: 'small-card', label: 'Small Card', w: 4, h: 2 },
  { type: 'table', label: 'Table', w: 5, h: 3 },
]

function MetricCard({ title, value, unit }) {
  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {value}
        <span className="metric-unit">{unit}</span>
        <span className="metric-arrow">↑</span>
      </div>
      <div className="metric-sparkline" />
    </div>
  )
}

function renderComponent(type) {
  switch (type) {
    case 'frame-grid':
      return (
        <div className="frame frame-main fill">
          <div className="frame-title">Frame</div>
          <div className="frame-grid fill">
            {Array.from({ length: 18 }).map((_, r) => (
              <div className="grid-row" key={`r-${r}`}>
                {Array.from({ length: 16 }).map((_, c) => (
                  <div className="grid-cell" key={`c-${c}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )
    case 'media':
      return (
        <div className="media-card fill">
          <div className="frame-label">Frame 3</div>
          <img
            src="https://images.unsplash.com/photo-1502877828070-33b167ad6860?auto=format&fit=crop&w=900&q=80"
            alt="Race car on track"
            className="media-image"
          />
        </div>
      )
    case 'weather':
      return (
        <div className="weather-card fill">
          <div className="weather-main">Sunny</div>
          <div className="weather-temp">
            73<span className="weather-unit">°F</span>
          </div>
          <div className="weather-meta">Humidity: 40%</div>
        </div>
      )
    case 'metric-duo':
      return (
        <div className="metrics-row fill">
          <div className="component-label">Component 1</div>
          <div className="metric-grid">
            <MetricCard title="Speed" value="26" unit="mph" />
            <MetricCard title="Motor Temp" value="26" unit="°C" />
          </div>
        </div>
      )
    case 'sparkline-panel':
      return (
        <div className="frame-two fill">
          <div className="frame-label">Frame 2</div>
          <div className="sparkline-panel">
            {['Speed', 'Throttle', 'Brake Pressure', 'Acceleration', 'Brake Pressure', 'Brake Pressure'].map(
              (label, idx) => (
                <div className="sparkline-card" key={`${label}-${idx}`}>
                  <div className="sparkline-title">{label}</div>
                  <div className="sparkline" />
                </div>
              )
            )}
          </div>
        </div>
      )
    case 'frame-four':
      return (
        <div className="frame-four fill">
          <div className="frame-label">Frame 4</div>
          <div className="list-card">
            <div className="list-row">Speed</div>
            <div className="list-row">Speed</div>
          </div>
        </div>
      )
    case 'pill':
      return <div className="pill fill">Pill</div>
    case 'small-card':
      return (
        <div className="small-card fill">
          Component levels can be nested and locked by changing these components.
        </div>
      )
    case 'table':
      return (
        <div className="table-card fill">
          <div className="table-title">Table 1</div>
          <div className="mini-table" />
        </div>
      )
    default:
      return <div className="fallback-block">Block</div>
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
  const [logFile, setLogFile] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [layoutLocked, setLayoutLocked] = useState(false)

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
    }
    setShapes((s) => [...s, newShape])
    setSelectedId(id)
  }

  function onUpdateShape(id, patch) {
    if (layoutLocked) return
    setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function deleteSelected() {
    if (layoutLocked) return
    if (!selectedId) return
    setShapes((arr) => arr.filter((s) => s.id !== selectedId))
    setSelectedId(null)
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
        setShapes(validatedConfig.shapes)
        setPanX(validatedConfig.view.panX)
        setPanY(validatedConfig.view.panY)
        setZoom(validatedConfig.view.zoom)
        setSelectedId(null)
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
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (layoutLocked || !selectedId || event.key !== 'Delete') return

      const target = event.target
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

      if (isTypingTarget) return

      setShapes((arr) => arr.filter((s) => s.id !== selectedId))
      setSelectedId(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [layoutLocked, selectedId])

  return (
    <div className="app-shell">
      <ControlBar
        dataSource={dataSource}
        setDataSource={setDataSource}
        usbPort={usbPort}
        setUsbPort={setUsbPort}
        logFile={logFile}
        setLogFile={setLogFile}
        isRunning={isRunning}
        setIsRunning={setIsRunning}
        onOpenPalette={() => setPaletteOpen(true)}
        layoutLocked={layoutLocked}
      />
      <Editor
        shapes={shapes}
        onUpdateShape={onUpdateShape}
        onSelectShape={setSelectedId}
        selectedId={selectedId}
        panX={panX}
        setPanX={setPanX}
        panY={panY}
        setPanY={setPanY}
        gridSize={GRID_SIZE}
        zoom={zoom}
        setZoom={setZoom}
        renderShape={(shape) => renderComponent(shape.type)}
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
    </div>
  )
}

export default App
