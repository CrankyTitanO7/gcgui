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

export default function Palette({ components, onAdd, onDelete, onClear, hasSelection }) {
  return (
    <div className="palette-sidebar">
      <div className="palette-header">Components</div>

      <div className="section">
        <div className="section-title">Drag & drop</div>
        <div className="component-list">
          {components.map((item) => (
            <button
              key={item.type}
              className="component-chip"
              onClick={() => onAdd(item)}
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
        <button
          className="delete-btn"
          onClick={onDelete}
          disabled={!hasSelection}
          title={hasSelection ? 'Delete selected block' : 'No selection'}
        >
          Delete Selected
        </button>
        <button className="clear-btn" onClick={onClear} title="Remove all blocks">
          Clear All
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
  )
}
