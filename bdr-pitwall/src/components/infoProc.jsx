import { createContext, useContext, useEffect, useState } from 'react';

// Global context for CAN data
export const CANDataContext = createContext();

// CAN message types and their field mappings with byte specifications
// const CAN_MESSAGE_TYPES = {
//   '0x100': { 
//     name: 'EngineData', 
//     fields: [
//       { name: 'RPM', bytes: 2, offset: 0, scale: 1, unit: 'RPM' },
//       { name: 'Throttle', bytes: 1, offset: 2, scale: 1, unit: '%' },
//       { name: 'EngineTemp', bytes: 1, offset: 3, scale: 1, unit: '°C' },
//       { name: 'OilPressure', bytes: 1, offset: 4, scale: 0.1, unit: 'psi' }
//     ]
//   },
//   '0x200': { 
//     name: 'BatteryData', 
//     fields: [
//       { name: 'Voltage', bytes: 2, offset: 0, scale: 0.1, unit: 'V' },
//       { name: 'Current', bytes: 2, offset: 2, scale: 0.1, unit: 'A' },
//       { name: 'Temperature', bytes: 1, offset: 4, scale: 1, unit: '°C' },
//       { name: 'SOC', bytes: 1, offset: 5, scale: 1, unit: '%' }
//     ]
//   },
//   '0x300': { 
//     name: 'SpeedData', 
//     fields: [
//       { name: 'Speed', bytes: 2, offset: 0, scale: 0.1, unit: 'km/h' },
//       { name: 'Gear', bytes: 1, offset: 2, scale: 1, unit: '' },
//       { name: 'Distance', bytes: 2, offset: 3, scale: 1, unit: 'km' },
//       { name: 'TripTime', bytes: 1, offset: 5, scale: 1, unit: 'min' }
//     ]
//   },
//   '0x400': { 
//     name: 'SensorData', 
//     fields: [
//       { name: 'Pressure', bytes: 2, offset: 0, scale: 0.01, unit: 'bar' },
//       { name: 'FlowRate', bytes: 2, offset: 2, scale: 0.1, unit: 'L/min' },
//       { name: 'Level', bytes: 1, offset: 4, scale: 1, unit: '%' },
//       { name: 'Status', bytes: 1, offset: 5, scale: 1, unit: '' }
//     ]
//   }
// };

const CAN_MESSAGE_TYPES = {
  '0x20': {
    name: 'GeneralData1',
    fields: ['ERPM', 'DutyCycle', 'InputVoltage'],
    encoding: {
      ERPM:         { bytes: [0,1,2,3], type: 'int32be',  scale: 1,   unit: 'ERPM', note: 'Motor RPM * pole pairs' },
      DutyCycle:    { bytes: [4,5],     type: 'int16be',  scale: 0.1, unit: '%',    note: '+ running, - regen' },
      InputVoltage: { bytes: [6,7],     type: 'int16be',  scale: 1,   unit: 'V',    note: 'DC bus voltage' }
    }
  },
  '0x21': {
    name: 'GeneralData2',
    fields: ['ACCurrent', 'DCCurrent'],
    encoding: {
      ACCurrent: { bytes: [0,1],   type: 'int16be', scale: 0.1, unit: 'Apk', note: '+ running, - regen' },
      DCCurrent: { bytes: [2,3],   type: 'int16be', scale: 0.1, unit: 'Apk', note: '+ running, - regen' },
      // bytes [4–7]: reserved, filled with 0xFF
    }
  },
  '0x22': {
    name: 'GeneralData3',
    fields: ['ControllerTemp', 'MotorTemp', 'FaultCode'],
    encoding: {
      ControllerTemp: { bytes: [0,1], type: 'int16be', scale: 0.1, unit: '°C', note: 'Inverter semiconductor temp' },
      MotorTemp:      { bytes: [2,3], type: 'int16be', scale: 0.1, unit: '°C', note: 'Motor temp via inverter' },
      FaultCode:      { bytes: [4],   type: 'uint8',   scale: 1,   unit: '#',  note: '0 = no fault; see fault chart' },
      // bytes [5–7]: reserved, filled with 0xFF
    }
  },
  '0x23': {
    name: 'GeneralData4',
    fields: ['Id', 'Iq'],
    encoding: {
      Id: { bytes: [0,1,2,3], type: 'int32be', scale: 0.01, unit: 'Apk', note: 'FOC d-axis current' },
      Iq: { bytes: [4,5,6,7], type: 'int32be', scale: 0.01, unit: 'Apk', note: 'FOC q-axis current' }
    }
  },
  '0x24': {
    name: 'GeneralData5',
    fields: ['Throttle', 'Brake', 'DigitalInputs', 'DigitalOutputs', 'DriveEnable', 'LimitFlags', 'CANMapVersion'],
    encoding: {
      Throttle:       { bytes: [0],    type: 'int8',   scale: 1, unit: '%', note: 'From analog input or CAN2; -128 to 127' },
      Brake:          { bytes: [1],    type: 'int8',   scale: 1, unit: '%', note: 'From analog input or CAN2; -128 to 127' },
      DigitalInputs:  { bytes: [2],    type: 'uint8',  scale: 1, unit: '#', note: 'Bits 0-3: DI1-DI4 (1 = active)' },
      DigitalOutputs: { bytes: [2],    type: 'uint8',  scale: 1, unit: '#', note: 'Bits 4-7: DO1-DO4 (1 = active)' },
      DriveEnable:    { bytes: [3],    type: 'uint8',  scale: 1, unit: '#', note: 'Bit 0: 1 = drive enabled' },
      LimitFlags:     { bytes: [4,5],  type: 'uint16', scale: 1, unit: '#', note: 'Bits: CapTemp/DCLim/DriveEnLim/IGBTAccel/IGBTTemp/VinLim/MtrAccelTemp/MtrTemp/RPMMin/RPMMax/PowerLim' },
      // byte [6]: reserved 0xFF
      CANMapVersion:  { bytes: [7],    type: 'uint8',  scale: 1, unit: '#', note: 'e.g. 23 → v2.3' }
    }
  }, 
  // radio can messages
  '0x31': {
  name: 'RadioStatus',
  fields: ['Opcode', 'RSSI'],
  encoding: {
    Opcode: { bytes: [0,1], type: 'int16be', scale: 1,   unit: '#',   note: 'RadioLib state code. 0 = OK' },
    RSSI:   { bytes: [2,3], type: 'int16be', scale: 0.1, unit: 'dBm', note: 'Signal strength × 10' }
  }
},
};

// Global state for parsed CAN data
const useCANData = () => {
  const [canData, setCANData] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(false);

  // Initialize all CAN message types with default values
  const initializeCANData = () => {
    const initialData = {};
    Object.keys(CAN_MESSAGE_TYPES).forEach(id => {
      const message = CAN_MESSAGE_TYPES[id];
      initialData[id] = {
        id: id,
        name: message.name,
        timestamp: null,
        fields: {}
      };
      message.fields.forEach(field => {
        initialData[id].fields[field] = null;
      });
    });
    return initialData;
  };

  useEffect(() => {
    // Initialize with default values
    setCANData(initializeCANData());
  }, []);

  // Parse CAN Log Format messages
  const parseCANMessage = (rawMessage) => {
  try {
    const message = rawMessage.trim();
    // Skip CRTD header/comment lines
    if (!message || message.startsWith('CXX')) return null;

    let dataPart = message;
    let timestamp = new Date().toISOString();

    // Extract unix timestamp
    const tsMatch = message.match(/^(\d+\.\d+)\s+/);
    if (tsMatch) {
      timestamp = tsMatch[1];
      dataPart = message.slice(tsMatch[0].length);
    }

    const parts = dataPart.trim().split(/\s+/);
    if (parts.length < 2) return null;

    let startIndex = 0;

    // Skip bus/direction/bit-length token e.g. "1R11", "2R29", "R11"
    if (/^\d?[RT]\d{2}$/.test(parts[0])) {
      startIndex = 1;
    }

    // FIX 1: Normalize ID — strip leading zeros so "020" → "0x20"
    const rawId = parts[startIndex];
    const idNum = parseInt(rawId, 16);
    if (isNaN(idNum)) return null;
    const id = '0x' + idNum.toString(16); // "0x20", "0x21", etc.

    // FIX 2: No DLC in CRTD — everything after the ID is data bytes
    const dataBytes = parts.slice(startIndex + 1);

    if (!CAN_MESSAGE_TYPES[id] || dataBytes.length === 0) {
      console.warn('Unknown CAN ID:', id);
      return null;
    }

    const messageConfig = CAN_MESSAGE_TYPES[id];
    const dataBuffer = new Uint8Array(dataBytes.map(b => parseInt(b, 16)));

    const parsedData = {
      id,
      name: messageConfig.name,
      timestamp,
      dataBytes,
      fields: {}
    };

    messageConfig.fields.forEach(fieldName => {
      const encoding = messageConfig.encoding[fieldName];
      if (!encoding) {
        parsedData.fields[fieldName] = { value: null, unit: '', raw: null };
        return;
      }

      const { bytes, type, scale, unit } = encoding;

      // Check all required bytes are present
      if (!bytes || bytes.length === 0 || Math.max(...bytes) >= dataBuffer.length) {
        parsedData.fields[fieldName] = { value: null, unit, raw: null };
        return;
      }

      // Read raw unsigned value from byte positions (avoid bitwise to stay >32-bit safe)
      let raw = 0;
      bytes.forEach(pos => { raw = raw * 256 + dataBuffer[pos]; });

      // FIX 3: Convert to signed based on type
      let signed = raw;
      if (type === 'int32be' && raw >= 0x80000000) {
        signed = raw - 0x100000000;
      } else if (type === 'int16be' && raw >= 0x8000) {
        signed = raw - 0x10000;
      } else if (type === 'int8' && raw >= 0x80) {
        signed = raw - 0x100;
      }

      const value = Math.round(signed * scale * 100) / 100;
      parsedData.fields[fieldName] = { value, unit, raw };
    });

    return parsedData;

  } catch (error) {
    console.error('Error parsing CAN message:', error, rawMessage);
    return null;
  }
};

  // Handle incoming serial data
  const handleSerialData = (data) => {
    const message = data.toString();
    
    // Parse the message
    const parsedMessage = parseCANMessage(message);
    
    if (parsedMessage) {
      // Update the specific message type
      setCANData(prev => ({
        ...prev,
        [parsedMessage.id]: parsedMessage
      }));
      setLastUpdate(new Date());
    }
  };

  // Handle connection status changes
  const handleConnectionStatus = (status) => {
    setConnectionStatus(status);
  };

  return {
    canData,
    lastUpdate,
    connectionStatus,
    handleSerialData,
    handleConnectionStatus,
    CAN_MESSAGE_TYPES
  };
};

// InfoProc component that processes serial data
export const InfoProcProvider = ({ children }) => {
  const canData = useCANData();

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not available in InfoProc');
      return;
    }

    let cleanupData = null;
    let cleanupStatus = null;

    // Listen for serial data
    if (window.electronAPI.onSerialData) {
      cleanupData = window.electronAPI.onSerialData(canData.handleSerialData);
    }

    // Listen for connection status
    if (window.electronAPI.onSerialConnectionStatus) {
      cleanupStatus = window.electronAPI.onSerialConnectionStatus(canData.handleConnectionStatus);
    }

    // Cleanup on unmount
    return () => {
      if (cleanupData) cleanupData();
      if (cleanupStatus) cleanupStatus();
    };
  }, [canData.handleSerialData, canData.handleConnectionStatus]);

  return (
    <CANDataContext.Provider value={canData}>
      {children}
    </CANDataContext.Provider>
  );
};

// Hook to use CAN data in components
export const useCANDataHook = () => {
  const context = useContext(CANDataContext);
  if (!context) {
    throw new Error('useCANDataHook must be used within a InfoProcProvider');
  }
  return context;
};

// Debug component to display parsed CAN data
export const CANDataDebugger = () => {
  const { canData, lastUpdate, connectionStatus, CAN_MESSAGE_TYPES } = useCANDataHook();
  const [hoveredField, setHoveredField] = useState(null);

  const handleFieldHover = (fieldName, encoding) => {
    setHoveredField({
      fieldName,
      note: encoding ? encoding.note : '',
      type: encoding ? encoding.type : '',
      bytes: encoding ? encoding.bytes : []
    });
  };

  const handleFieldLeave = () => {
    setHoveredField(null);
  };

  return (
    <div className="can-data-debugger" style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '10px',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '12px',
      margin: '10px 0',
      position: 'relative'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#4caf50' }}>
        CAN Data Parser (β)
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        Status: {connectionStatus ? 'Connected' : 'Disconnected'}
        {lastUpdate && (
          <span style={{ marginLeft: '10px', color: '#888' }}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {Object.keys(CAN_MESSAGE_TYPES).map(id => {
        const message = canData[id];
        if (!message) return null;

        const messageConfig = CAN_MESSAGE_TYPES[id];

        return (
          <div key={id} style={{ marginBottom: '15px', border: '1px solid #444', borderRadius: '4px', padding: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#2196f3' }}>
              {message.name} ({id})
              {message.timestamp && (
                <span style={{ marginLeft: '10px', color: '#888', fontSize: '10px' }}>
                  {message.timestamp}
                </span>
              )}
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '3px',
              maxHeight: '350px',
              overflow: 'auto',
              paddingRight: '4px'
            }}>
              {messageConfig.fields.map(fieldName => {
                const fieldData = message.fields[fieldName];
                const encoding = messageConfig.encoding[fieldName];
                const unit = encoding ? encoding.unit : '';
                const scale = encoding ? encoding.scale : 1;
                const rawValue = fieldData && fieldData.raw !== null ? fieldData.raw : null;
                const scaledValue = fieldData && fieldData.value !== null ? fieldData.value : null;
                
                return (
                  <div 
                    key={fieldName} 
                    style={{ 
                      background: '#2a2a2a', 
                      padding: '4px', 
                      borderRadius: '3px',
                      cursor: encoding && encoding.note ? 'help' : 'default',
                      position: 'relative',
                      minHeight: '35px',
                      fontSize: '10px' // Further reduced base font size
                    }}
                    onMouseEnter={() => encoding && encoding.note && handleFieldHover(fieldName, encoding)}
                    onMouseLeave={handleFieldLeave}
                  >
                    {/* Field Name */}
                    <div style={{ 
                      fontSize: '8px', // Further reduced field name
                      color: '#888', 
                      marginBottom: '1px',
                      fontWeight: 'bold',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {fieldName}
                    </div>
                    
                    {/* Main Value Display */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                      {/* Raw Value + Scale Factor */}
                      <div style={{ 
                        fontSize: '8px', // Further reduced raw value
                        color: '#666',
                        fontFamily: 'monospace',
                        flexShrink: 0
                      }}>
                        {rawValue !== null 
                          ? `${rawValue} × ${scale}`
                          : 'N/A'
                        }
                      </div>
                      
                      {/* Main Scaled Value */}
                      <div style={{ 
                        fontSize: '14px', // Further reduced main value size
                        fontWeight: 'bold', 
                        color: fieldData && fieldData.value !== null ? '#fff' : '#666',
                        flex: 1,
                        textAlign: 'right'
                      }}>
                        {scaledValue !== null ? scaledValue : 'N/A'}
                      </div>
                      
                      {/* Unit */}
                      <div style={{ 
                        fontSize: '9px', // Further reduced unit
                        color: '#aaa',
                        fontWeight: 'normal',
                        flexShrink: 0
                      }}>
                        {unit}
                      </div>
                    </div>
                    
                    {/* Note Description (if available and space allows) */}
                    {encoding && encoding.note && (
                      <div style={{ 
                        fontSize: '7px', // Further reduced note
                        color: '#888', 
                        marginTop: '1px',
                        lineHeight: '1.1',
                        maxHeight: '15px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {encoding.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Hover popup */}
      {hoveredField && (
        <div 
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#2a2a2a',
            border: '1px solid #666',
            borderRadius: '6px',
            padding: '15px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1000,
            minWidth: '300px',
            maxWidth: '400px'
          }}
          onClick={handleFieldLeave}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#2196f3' }}>
            {hoveredField.fieldName}
          </div>
          {hoveredField.type && (
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
              Type: {hoveredField.type}
            </div>
          )}
          {hoveredField.bytes && hoveredField.bytes.length > 0 && (
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
              Bytes: {hoveredField.bytes.join(', ')}
            </div>
          )}
          {hoveredField.note && (
            <div style={{ fontSize: '12px', color: '#ddd', lineHeight: '1.4' }}>
              {hoveredField.note}
            </div>
          )}
          <div style={{ fontSize: '10px', color: '#666', marginTop: '8px', textAlign: 'right' }}>
            Click outside to close
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoProcProvider;