import React from 'react'

export default function Editor({ editorRect, setEditorRect, shapes, onUpdateShape, onSelectShape, selectedId }) {
  const editorStyle = {
    position: 'absolute',
    left: editorRect.x,
    top: editorRect.y,
    width: editorRect.width,
    height: editorRect.height,
    border: '2px dashed #888',
    background: '#fff',
    boxSizing: 'border-box',
    overflow: 'hidden',
  }

  function startMove(e) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startRect = { ...editorRect }
    function onMove(ev) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      setEditorRect({ ...startRect, x: startRect.x + dx, y: startRect.y + dy })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startResize(e) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startRect = { ...editorRect }
    function onMove(ev) {
      const dw = ev.clientX - startX
      const dh = ev.clientY - startY
      setEditorRect({ ...startRect, width: Math.max(100, startRect.width + dw), height: Math.max(60, startRect.height + dh) })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="editor" style={editorStyle}>
      <div className="editor-header" onMouseDown={startMove}>Editor Area</div>
      <div className="editor-canvas">
        {shapes.map((s, idx) => (
          <div
            key={s.id}
            className={`shape ${s.type} ${selectedId === s.id ? 'selected' : ''}`}
            style={{ left: s.x, top: s.y, width: s.width, height: s.height, background: s.color, zIndex: idx }}
            onMouseDown={(ev) => {
              ev.stopPropagation()
              // set selection first
              onSelectShape && onSelectShape(s.id)
              const startX = ev.clientX
              const startY = ev.clientY
              const startPos = { x: s.x, y: s.y }
              function onMove(e2) {
                const dx = e2.clientX - startX
                const dy = e2.clientY - startY
                onUpdateShape(s.id, { x: startPos.x + dx, y: startPos.y + dy })
              }
              function onUp() {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          >
            <div
              className="resize-handle"
              onMouseDown={(ev) => {
                ev.stopPropagation()
                const startX = ev.clientX
                const startY = ev.clientY
                const startSize = { width: s.width, height: s.height }
                function onMove(e2) {
                  const dw = e2.clientX - startX
                  const dh = e2.clientY - startY
                  onUpdateShape(s.id, { width: Math.max(20, startSize.width + dw), height: Math.max(20, startSize.height + dh) })
                }
                function onUp() {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />
          </div>
        ))}
      </div>
      <div className="editor-resize" onMouseDown={startResize} />
    </div>
  )
}
