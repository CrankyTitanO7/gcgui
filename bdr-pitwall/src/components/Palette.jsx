import React from 'react'

function Preview({ type }) {
  switch (type) {
    case 'frame-grid':
      return (
        <div className="preview-block grid">
          <div className="preview-rows">
            {Array.from({ length: 3 }).map((_, r) => (
              <div key={r} className="preview-row" />
            ))}
          </div>
        </div>
      )
    case 'media':
      return <div className="preview-block media" />
    case 'weather':
      return (
        <div className="preview-block weather">
          <div className="preview-title">73°F</div>
          <div className="preview-sub">Sunny</div>
        </div>
      )
    case 'metric-duo':
      return (
        <div className="preview-block metrics">
          <div className="preview-title">26 mph</div>
          <div className="preview-title">26 °C</div>
        </div>
      )
    case 'sparkline-panel':
      return (
        <div className="preview-block spark">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="preview-row short" />
          ))}
        </div>
      )
    case 'frame-four':
      return (
        <div className="preview-block list">
          <div className="preview-row short" />
          <div className="preview-row short" />
        </div>
      )
    case 'pill':
      return <div className="preview-block pill">Pill</div>
    case 'small-card':
      return <div className="preview-block card">Text</div>
    case 'table':
      return <div className="preview-block table" />
    default:
      return <div className="preview-block" />
  }
}

export default function Palette({
  components,
  onAdd,
  onDelete,
  onSave,
  onLoad,
  onReset,
  hasSelection,
  isOpen,
  onClose,
  isLocked,
  onToggleLayoutLock,
}) {
  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      onLoad(file)
      // Clear the file input so the same file can be loaded again
      event.target.value = null
    }
  }

  const handleOverlayClick = (e) => {
    if (isOpen && e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={`palette-overlay ${isOpen ? 'open' : 'closed'}`} onClick={handleOverlayClick}>
      <div className="palette-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="palette-header">Components</div>
          <button className="palette-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="section">
          <div className="section-title">Add Widgets</div>
          <div className="component-list">
            {components.map((item) => (
              <button
                key={item.type}
                className="component-chip"
                onClick={() => {
                  if (isLocked) return
                  onAdd(item)
                  onClose()
                }}
                title={`Add ${item.label}`}
              >
                <div className="chip-preview">
                  <Preview type={item.type} />
                </div>
                <div className="chip-meta">
                  <span>{item.label}</span>
                  <span className="chip-size">
                    {item.w}x{item.h}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-title">Configuration</div>
          <div className="config-controls">
            <button
              className={`config-btn ${isLocked ? 'reset-btn' : 'save-btn'}`}
              onClick={onToggleLayoutLock}
              title={isLocked ? 'Unlock layout for editing' : 'Lock layout to prevent edits'}
            >
              {isLocked ? 'Unlock Layout' : 'Lock Layout'}
            </button>
            <button 
              className="config-btn save-btn" 
              onClick={onSave} 
              title="Save current layout"
            >
              Save Layout
            </button>
            <label className="config-btn load-btn" title="Load saved layout">
              Load Layout
              <input 
                type="file" 
                accept=".json,application/json" 
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            <button 
              className="config-btn reset-btn" 
              onClick={onReset} 
              title="Reset to default"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="section">
          <button
            className="delete-btn"
            onClick={onDelete}
            disabled={!hasSelection || isLocked}
            title={hasSelection ? 'Delete selected block' : 'No selection'}
          >
            Delete Selected
          </button>
        </div>

        <div className="section hint">
          <div style={{ fontSize: 12, color: '#c9cee8' }}>
            <p>• Left-click to move blocks</p>
            <p>• Drag corner handles to resize</p>
            <p>• Middle-click (or Ctrl+drag) to pan canvas</p>
            <p>• Use mouse wheel to zoom</p>
            <p>• Blocks snap to the grid</p>
          </div>
        </div>
      </div>
    </div>
  )
}
