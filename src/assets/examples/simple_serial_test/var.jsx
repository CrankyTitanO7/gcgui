// paste this in for can message types to use this simple USB serial test
// replace THIS EXACT VARIABLE NAME and upload the counterpart code to arduino

const CAN_MESSAGE_TYPES = {
  '0x100': { 
    name: 'EngineData', 
    fields: [
      { name: 'RPM', bytes: 2, offset: 0, scale: 1, unit: 'RPM' },
      { name: 'Throttle', bytes: 1, offset: 2, scale: 1, unit: '%' },
      { name: 'EngineTemp', bytes: 1, offset: 3, scale: 1, unit: '°C' },
      { name: 'OilPressure', bytes: 1, offset: 4, scale: 0.1, unit: 'psi' }
    ]
  },
  '0x200': { 
    name: 'BatteryData', 
    fields: [
      { name: 'Voltage', bytes: 2, offset: 0, scale: 0.1, unit: 'V' },
      { name: 'Current', bytes: 2, offset: 2, scale: 0.1, unit: 'A' },
      { name: 'Temperature', bytes: 1, offset: 4, scale: 1, unit: '°C' },
      { name: 'SOC', bytes: 1, offset: 5, scale: 1, unit: '%' }
    ]
  },
  '0x300': { 
    name: 'SpeedData', 
    fields: [
      { name: 'Speed', bytes: 2, offset: 0, scale: 0.1, unit: 'km/h' },
      { name: 'Gear', bytes: 1, offset: 2, scale: 1, unit: '' },
      { name: 'Distance', bytes: 2, offset: 3, scale: 1, unit: 'km' },
      { name: 'TripTime', bytes: 1, offset: 5, scale: 1, unit: 'min' }
    ]
  },
  '0x400': { 
    name: 'SensorData', 
    fields: [
      { name: 'Pressure', bytes: 2, offset: 0, scale: 0.01, unit: 'bar' },
      { name: 'FlowRate', bytes: 2, offset: 2, scale: 0.1, unit: 'L/min' },
      { name: 'Level', bytes: 1, offset: 4, scale: 1, unit: '%' },
      { name: 'Status', bytes: 1, offset: 5, scale: 1, unit: '' }
    ]
  }
};