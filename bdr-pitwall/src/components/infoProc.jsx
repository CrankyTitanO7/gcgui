import React, { useState, useEffect, createContext, useContext } from 'react';

// Global context for CAN data
export const CANDataContext = createContext();

// CAN message types and their field mappings HARDCODED
// const CAN_MESSAGE_TYPES = {
//   '0x100': { name: 'EngineData', fields: ['RPM', 'Throttle', 'EngineTemp', 'OilPressure'] },
//   '0x200': { name: 'BatteryData', fields: ['Voltage', 'Current', 'Temperature', 'SOC'] },
//   '0x300': { name: 'SpeedData', fields: ['Speed', 'Gear', 'Distance', 'TripTime'] },
//   '0x400': { name: 'SensorData', fields: ['Pressure', 'FlowRate', 'Level', 'Status'] }
// };

const CAN_MESSAGE_TYPES = {
  '0x20': {
    name: 'GeneralData1',
    fields: ['ERPM', 'DutyCycle', 'InputVoltage'],
    encoding: {
      ERPM:         { bytes: [0,1,2,3], type: 'int32be',  scale: 1,   unit: 'ERPM', note: 'Motor RPM × pole pairs' },
      DutyCycle:    { bytes: [4,5],     type: 'int16be',  scale: 0.1, unit: '%',    note: '+ running, − regen' },
      InputVoltage: { bytes: [6,7],     type: 'int16be',  scale: 1,   unit: 'V',    note: 'DC bus voltage' }
    }
  },
  '0x21': {
    name: 'GeneralData2',
    fields: ['ACCurrent', 'DCCurrent'],
    encoding: {
      ACCurrent: { bytes: [0,1],   type: 'int16be', scale: 0.1, unit: 'Apk', note: '+ running, − regen' },
      DCCurrent: { bytes: [2,3],   type: 'int16be', scale: 0.1, unit: 'Apk', note: '+ running, − regen' },
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
      Throttle:       { bytes: [0],    type: 'int8',   scale: 1, unit: '%', note: 'From analog input or CAN2; −128 to 127' },
      Brake:          { bytes: [1],    type: 'int8',   scale: 1, unit: '%', note: 'From analog input or CAN2; −128 to 127' },
      DigitalInputs:  { bytes: [2],    type: 'uint8',  scale: 1, unit: '#', note: 'Bits 0–3: DI1–DI4 (1 = active)' },
      DigitalOutputs: { bytes: [2],    type: 'uint8',  scale: 1, unit: '#', note: 'Bits 4–7: DO1–DO4 (1 = active)' },
      DriveEnable:    { bytes: [3],    type: 'uint8',  scale: 1, unit: '#', note: 'Bit 0: 1 = drive enabled' },
      LimitFlags:     { bytes: [4,5],  type: 'uint16', scale: 1, unit: '#', note: 'Bits: CapTemp/DCLim/DriveEnLim/IGBTAccel/IGBTTemp/VinLim/MtrAccelTemp/MtrTemp/RPMMin/RPMMax/PowerLim' },
      // byte [6]: reserved 0xFF
      CANMapVersion:  { bytes: [7],    type: 'uint8',  scale: 1, unit: '#', note: 'e.g. 23 → v2.3' }
    }
  }
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
      console.log('Parsing message:', rawMessage);
      
      // Support multiple CAN message formats:
      // Format 1: CRTD CAN Log Format: [timestamp] [ID] [DLC] [DataBytes]
      // Example: "[16:30:45.123] 0x100 8 12 34 56 78 9A BC DE F0"
      // Format 2: Your format: [timestamp] [identifier] [ID] [DLC] [DataBytes]
      // Example: "1711360000.120000 R11 100 04 9E 5B 5A 2B 00 00 00"
      
      const message = rawMessage.trim();
      
      // Skip if not a CAN message (should have ID and data)
      if (!message) return null;

      let timestamp = new Date().toISOString();
      let id = null;
      let dlc = 0;
      let dataBytes = [];
      let dataPart = message;

      // Try to extract timestamp (Unix timestamp format)
      const unixTimestampMatch = message.match(/^(\d+\.\d+)\s+/);
      if (unixTimestampMatch) {
        timestamp = unixTimestampMatch[1];
        dataPart = message.replace(/^\d+\.\d+\s+/, '');
        console.log('Extracted timestamp:', timestamp);
      }

      // Parse the remaining parts
      const parts = dataPart.trim().split(/\s+/);
      console.log('Parts after timestamp removal:', parts);
      
      if (parts.length < 3) return null;

      // Handle different formats
      let startIndex = 0;
      
      // If first part looks like an identifier (e.g., "R11"), skip it
      if (parts[0] && /^[A-Z]\d{1,2}$/.test(parts[0])) {
        startIndex = 1; // Skip the identifier part
        console.log('Skipping identifier:', parts[0]);
      }

      // Extract ID (with or without 0x prefix)
      id = parts[startIndex];
      if (!id.startsWith('0x')) {
        id = '0x' + id; // Add 0x prefix if missing
      }
      console.log('Extracted ID:', id);

      // Extract DLC
      dlc = parseInt(parts[startIndex + 1]);
      console.log('Extracted DLC:', dlc);
      
      // Extract data bytes (from remaining parts)
      dataBytes = parts.slice(startIndex + 2);
      console.log('Extracted data bytes:', dataBytes);

      // Validate message
      if (!CAN_MESSAGE_TYPES[id] || dataBytes.length === 0) {
        console.warn('Unknown or malformed CAN message:', message);
        return null;
      }

      const messageConfig = CAN_MESSAGE_TYPES[id];
      const parsedData = {
        id: id,
        name: messageConfig.name,
        timestamp: timestamp,
        dlc: dlc,
        dataBytes: dataBytes,
        fields: {}
      };

      // Parse data bytes according to message type
      const dataBuffer = new Uint8Array(dataBytes.map(byte => parseInt(byte, 16)));
      console.log('Data buffer:', dataBuffer);
      
      // Map fields based on message type
      messageConfig.fields.forEach((field, index) => {
        if (index < dataBuffer.length) {
          // Convert hex byte to decimal value
          const value = dataBuffer[index];
          console.log(`Field ${field} (index ${index}): ${value}`);
          parsedData.fields[field] = value;
        } else {
          console.log(`Field ${field} (index ${index}): No data available`);
        }
      });

      console.log('Final parsed data:', parsedData);
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

  return (
    <div className="can-data-debugger" style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '10px',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '12px',
      margin: '10px 0'
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
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
              {Object.keys(message.fields).map(fieldName => (
                <div key={fieldName} style={{ 
                  background: '#2a2a2a', 
                  padding: '4px', 
                  borderRadius: '3px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ color: '#aaa' }}>{fieldName}:</span>
                  <span style={{ color: message.fields[fieldName] !== null ? '#fff' : '#666' }}>
                    {message.fields[fieldName] !== null ? message.fields[fieldName] : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InfoProcProvider;