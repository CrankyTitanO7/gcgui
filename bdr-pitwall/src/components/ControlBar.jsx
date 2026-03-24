import React, { useRef } from 'react'

export default function ControlBar({
  dataSource,
  setDataSource,
  usbPort,
  setUsbPort,
  logFile,
  setLogFile,
  isRunning,
  setIsRunning,
  onOpenPalette,
  layoutLocked,
  availablePorts = [],
  isScanning = false,
  onRefreshPorts,
}) {
  const fileInputRef = useRef(null)

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setLogFile(file)
      // Reset the input so the same file can be selected again
      event.target.value = null
    }
  }

  const handleToggleRun = () => {
    setIsRunning(!isRunning)
  }


  return (
    <div className="control-bar">
      {/* Data Source Selection */}
      <div className="control-group">
        <span className="control-label">Data Source:</span>
        <div className="radio-group">
          <label className={`radio-option ${dataSource === 'live' ? 'active' : ''}`} htmlFor="live-data">
            <input
              type="radio"
              id="live-data"
              value="live"
              checked={dataSource === 'live'}
              onChange={(e) => setDataSource(e.target.value)}
            />
            <span>Live Data</span>
          </label>
          <label className={`radio-option ${dataSource === 'log' ? 'active' : ''}`} htmlFor="log-file">
            <input
              type="radio"
              id="log-file"
              value="log"
              checked={dataSource === 'log'}
              onChange={(e) => setDataSource(e.target.value)}
            />
            <span>Replay Log</span>
          </label>
        </div>
      </div>

      {/* USB Port Selection for Live Data */}
      {dataSource === 'live' && (
        <div className="control-group">
          <label htmlFor="usb-port" className="control-label">USB Port:</label>
          <div className="usb-port-selector">
            <select
              id="usb-port"
              className="control-select"
              value={usbPort || ''}
              onChange={(e) => setUsbPort(e.target.value)}
              disabled={isScanning}
            >
              <option value="">-- Select a port --</option>
              {isScanning ? (
                <option value="">Scanning for ports...</option>
              ) : availablePorts.length === 0 ? (
                <option value="">No ports found</option>
              ) : (
                availablePorts.map((port) => (
                  <option key={port.path} value={port.path}>
                    {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                  </option>
                ))
              )}
            </select>
            <button
              className="refresh-button"
              onClick={onRefreshPorts}
              disabled={isScanning}
              title="Refresh port list"
            >
              🔄
            </button>
          </div>
          {usbPort && (
            <div className="port-info">
              Connected to: {usbPort}
            </div>
          )}
        </div>
      )}

      {/* Log File Selection for Replay */}
      {dataSource === 'log' && (
        <div className="control-group">
          <label htmlFor="log-file-input" className="control-label">Log File:</label>
          <input
            ref={fileInputRef}
            id="log-file-input"
            type="file"
            accept=".csv,.json,.log"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="control-button"
            onClick={() => fileInputRef.current?.click()}
          >
            {logFile ? `${logFile.name}` : 'Select File'}
          </button>
        </div>
      )}

      {/* Start/Pause Buttons */}
      <div className="control-group">
        <button
          className={`control-button ${isRunning ? 'primary' : ''}`}
          onClick={handleToggleRun}
          disabled={
            dataSource === 'live' && !usbPort.trim()
              ? true
              : dataSource === 'log' && !logFile
              ? true
              : false
          }
        >
          {isRunning ? '⏸ Pause' : '▶ Start'}
        </button>
      </div>

      <div className="control-group control-group-right">
        <button
          className="control-button"
          onClick={onOpenPalette}
          title="Open layout editor"
        >
          ✎ Layout Editor
        </button>
        <span
          className={`layout-lock-indicator ${layoutLocked ? 'locked' : 'unlocked'}`}
          aria-label={layoutLocked ? 'Layout locked' : 'Layout unlocked'}
          title={layoutLocked ? 'Layout locked' : 'Layout unlocked'}
        >
          {layoutLocked ? '🔒' : '🔓'}
        </span>
      </div>

    </div>
  )
}
