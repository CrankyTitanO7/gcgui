import React from 'react'

export default function Palette({ onAdd, selectedId, selectedShape, onDelete, onClear, onColorChange, onReorder }) {
  return (
    <div className="palette">
      <div className="palette-title">Palette</div>
      <button onClick={() => onAdd('rect')}>Add Rectangle</button>
      <button onClick={() => onAdd('circle')}>Add Circle</button>
      <hr />
      <button onClick={onDelete} disabled={!selectedId} title={selectedId ? 'Delete selected object' : 'No selection'}>Delete Selected</button>
      <button onClick={onClear} title="Remove all objects">Clear All</button>

      {selectedId && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Selected: {selectedShape?.type}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>Color</span>
            <input type="color" value={selectedShape?.color || '#ffffff'} onChange={(e) => onColorChange && onColorChange(selectedId, e.target.value)} />
          </label>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Layer</div>
            <button onClick={() => onReorder && onReorder('back')}>Send to Back</button>
            <button onClick={() => onReorder && onReorder('backward')}>Send Backward</button>
            <button onClick={() => onReorder && onReorder('forward')}>Bring Forward</button>
            <button onClick={() => onReorder && onReorder('front')}>Bring to Front</button>
          </div>
        </div>
      )}
    </div>
  )
}
