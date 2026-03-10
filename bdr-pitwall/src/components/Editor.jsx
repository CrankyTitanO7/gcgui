import React, { useRef, useEffect } from 'react'

export default function Editor({
  shapes,
  onUpdateShape,
  onSelectShape,
  selectedId,
  panX,
  setPanX,
  panY,
  setPanY,
  gridSize,
  zoom,
  setZoom,
  renderShape,
}) {
  const canvasRef = useRef(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const MIN_ZOOM = 0.75
  const MAX_ZOOM = 1.5

  // Snap to grid helper
  const snapToGrid = (value) => Math.round(value / gridSize) * gridSize

  // Handle canvas panning with middle mouse button or ctrl+drag
  const handleCanvasMouseDown = (e) => {
    // Only pan with middle mouse button (button === 1) or if ctrl is held
    if (e.button !== 1 && !e.nativeEvent.ctrlKey) return
    if (e.target !== canvasRef.current) return

    e.preventDefault()
    isPanningRef.current = true
    panStartRef.current = { x: e.clientX, y: e.clientY }
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isPanningRef.current) return
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setPanX(panX + dx)
      setPanY(panY + dy)
      panStartRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      isPanningRef.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [panX, panY, setPanX, setPanY])

  // Draw grid pattern
  const gridPattern = `
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent ${gridSize - 1}px,
      rgba(255,255,255,0.08) ${gridSize - 1}px,
      rgba(255,255,255,0.08) ${gridSize}px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent ${gridSize - 1}px,
      rgba(255,255,255,0.08) ${gridSize - 1}px,
      rgba(255,255,255,0.08) ${gridSize}px
    )
  `

  const canvasStyle = {
    position: 'relative',
    flex: 1,
    width: '100%',
    height: '100%',
    background: '#0e1230',
    backgroundImage: gridPattern,
    backgroundPosition: `${panX}px ${panY}px`,
    backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
    overflow: 'hidden',
    cursor: 'grab',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
  }

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) return
    e.preventDefault()
    const delta = e.deltaY
    const factor = delta > 0 ? 0.95 : 1.05
    setZoom((z) => {
      const next = clampZoom(Number((z * factor).toFixed(2)))
      return next
    })
  }

  return (
    <div 
      className="editor-infinite"
      ref={canvasRef}
      style={canvasStyle}
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
    >
      {shapes.map((s, idx) => (
        <div
          key={s.id}
          className={`grid-shape ${selectedId === s.id ? 'selected' : ''}`}
          style={{
            position: 'absolute',
            left: s.x * zoom + panX,
            top: s.y * zoom + panY,
            width: s.width * zoom,
            height: s.height * zoom,
            background: 'transparent',
            boxSizing: 'border-box',
            border: selectedId === s.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
            zIndex: idx,
            userSelect: 'none',
            cursor: 'move',
          }}
          onMouseDown={(ev) => {
            if (ev.button !== 0) return // Only left click
            ev.stopPropagation()
            onSelectShape && onSelectShape(s.id)
            
            const startX = ev.clientX
            const startY = ev.clientY
            const startPos = { x: s.x, y: s.y }
            
            const onMove = (e2) => {
              const dx = (e2.clientX - startX) / zoom
              const dy = (e2.clientY - startY) / zoom
              const newX = snapToGrid(startPos.x + dx)
              const newY = snapToGrid(startPos.y + dy)
              onUpdateShape(s.id, { x: newX, y: newY })
            }
            
            const onUp = () => {
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }
            
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        >
          <div className="shape-body" style={{ width: '100%', height: '100%', fontSize: `${zoom}em` }}>
            {renderShape ? renderShape(s) : null}
          </div>
          <div
            className="grid-resize-handle"
            style={{
              position: 'absolute',
              right: -5,
              bottom: -5,
              width: 16,
              height: 16,
              background: '#3b82f6',
              cursor: 'nwse-resize',
              opacity: selectedId === s.id ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
            onMouseDown={(ev) => {
              ev.stopPropagation()
              const startX = ev.clientX
              const startY = ev.clientY
              const startSize = { width: s.width, height: s.height }
              
              const onMove = (e2) => {
                const dw = (e2.clientX - startX) / zoom
                const dh = (e2.clientY - startY) / zoom
                const newWidth = Math.max(gridSize, snapToGrid(startSize.width + dw))
                const newHeight = Math.max(gridSize, snapToGrid(startSize.height + dh))
                onUpdateShape(s.id, { width: newWidth, height: newHeight })
              }
              
              const onUp = () => {
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
  )
}
