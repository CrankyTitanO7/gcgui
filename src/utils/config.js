/**
 * Configuration management utilities for saving and loading editor state
 */

// Configuration version for future compatibility
const CONFIG_VERSION = '1.0.0'

/**
 * Save the current editor configuration to a JSON file
 * @param {Object} config - The configuration object to save
 * @param {string} filename - Optional filename (without extension)
 */
export function saveConfig(config, filename = 'pitwall-config') {
  // Add metadata
  const configWithMeta = {
    version: CONFIG_VERSION,
    timestamp: new Date().toISOString(),
    ...config
  }
  
  // Convert to JSON with pretty formatting
  const jsonString = JSON.stringify(configWithMeta, null, 2)
  
  // Create blob and download
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up
  URL.revokeObjectURL(url)
}

/**
 * Load configuration from a JSON file
 * @param {File} file - The JSON file to load
 * @returns {Promise<Object>} The loaded configuration
 */
export async function loadConfig(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result)
        resolve(config)
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * Create a configuration object from current editor state
 * @param {Array} shapes - Array of shape objects
 * @param {number} panX - Current pan X position
 * @param {number} panY - Current pan Y position
 * @param {number} zoom - Current zoom level
 * @returns {Object} Configuration object
 */
export function createConfig(shapes, panX, panY, zoom) {
  return {
    shapes: shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      name: shape.name,
      dataField: shape.dataField
    })),
    view: {
      panX,
      panY,
      zoom
    }
  }
}

/**
 * Validate and migrate configuration data
 * @param {Object} config - The loaded configuration
 * @returns {Object} Validated and migrated configuration
 */
export function validateConfig(config) {
  // Check if it's a valid config
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid configuration format')
  }
  
  // Check version compatibility (basic check)
  if (config.version && config.version !== CONFIG_VERSION) {
    console.warn(`Configuration version mismatch: expected ${CONFIG_VERSION}, got ${config.version}`)
  }
  
  // Validate shapes
  const rawShapes = config.shapes || []
  if (!Array.isArray(rawShapes)) {
    throw new Error('Invalid shapes format')
  }
  const shapes = rawShapes.map((shape) => ({
    ...shape,
    name: typeof shape?.name === 'string' ? shape.name : '',
    dataField: typeof shape?.dataField === 'string' ? shape.dataField : ''
  }))
  
  // Validate view settings
  const view = config.view || {}
  const panX = typeof view.panX === 'number' ? view.panX : 0
  const panY = typeof view.panY === 'number' ? view.panY : 0
  const zoom = typeof view.zoom === 'number' ? Math.max(0.5, Math.min(2, view.zoom)) : 1
  
  return {
    shapes,
    view: { panX, panY, zoom }
  }
}

/**
 * Get a default empty configuration
 * @returns {Object} Default configuration
 */
export function getDefaultConfig() {
  return {
    shapes: [],
    view: {
      panX: 0,
      panY: 0,
      zoom: 1
    }
  }
}