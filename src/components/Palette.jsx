import React from 'react'

function Preview({ type }) {
  switch (type) {
    case 'number':
      return (
        <div className="preview-block number">
          <div className="preview-title">72</div>
          <div className="preview-sub">speed</div>
        </div>
      )
    case 'line-plot':
      return (
        <div className="preview-block line">
          <div className="preview-line" />
        </div>
      )
    case 'send':
      return (
        <div className="preview-block number">
          <div className="preview-title">⏎</div>
          <div className="preview-sub">send</div>
        </div>
      )
    case 'key-send':
      return (
        <div className="preview-block number">
          <div className="preview-title">⌨</div>
          <div className="preview-sub">keys</div>
        </div>
      )
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
            <p>• Right-click a widget for Edit/Delete</p>
            <p>• Drag corner handles to resize</p>
            <p>• Middle-click (or Ctrl+drag) to pan canvas</p>
            <p>• Use mouse wheel to zoom</p>
            <p>• Press E to edit selected widget</p>
            <p>• Press Esc to close editor panels</p>
            <p>• Blocks snap to the grid</p>
          </div>
        </div>
      </div>
    </div>
  )
}
