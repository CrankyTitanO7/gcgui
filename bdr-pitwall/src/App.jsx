import { useState } from 'react'
import './App.css'
import Editor from './components/Editor'
import Palette from './components/Palette'

function App() {
  const [editorRect, setEditorRect] = useState({ x: 80, y: 80, width: 600, height: 360 })
  const [shapes, setShapes] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  function addShape(type) {
    const id = Date.now()
    const newShape = {
      id,
      type,
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      color: type === 'circle' ? '#8fd3ff' : '#ffd38f',
    }
    setShapes((s) => [...s, newShape])
  }

  function onUpdateShape(id, patch) {
    setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function onColorChange(id, color) {
    setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, color } : s)))
  }

  function onReorder(action) {
    setShapes((arr) => {
      const idx = arr.findIndex((s) => s.id === selectedId)
      if (idx === -1) return arr
      const copy = arr.slice()
      if (action === 'forward' && idx < copy.length - 1) {
        const tmp = copy[idx + 1]
        copy[idx + 1] = copy[idx]
        copy[idx] = tmp
        return copy
      }
      if (action === 'backward' && idx > 0) {
        const tmp = copy[idx - 1]
        copy[idx - 1] = copy[idx]
        copy[idx] = tmp
        return copy
      }
      if (action === 'front') {
        const [it] = copy.splice(idx, 1)
        copy.push(it)
        return copy
      }
      if (action === 'back') {
        const [it] = copy.splice(idx, 1)
        copy.unshift(it)
        return copy
      }
      return arr
    })
  }

  function deleteSelected() {
    if (!selectedId) return
    setShapes((arr) => arr.filter((s) => s.id !== selectedId))
    setSelectedId(null)
  }

  function clearAll() {
    setShapes([])
    setSelectedId(null)
  }

  return (
    <div className="app-root">
      <Palette onAdd={addShape} selectedId={selectedId} selectedShape={shapes.find(s => s.id === selectedId)} onDelete={deleteSelected} onClear={clearAll} onColorChange={onColorChange} onReorder={onReorder} />
      <Editor editorRect={editorRect} setEditorRect={setEditorRect} shapes={shapes} onUpdateShape={onUpdateShape} onSelectShape={setSelectedId} selectedId={selectedId} />
    </div>
  )
}

export default App
