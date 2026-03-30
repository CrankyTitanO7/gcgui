import { createContext, useContext, useEffect, useState } from 'react';

// Global context for CAN data
export const CANDataContext = createContext();

const CAN_MESSAGE_TYPES = {
  
  '0x202c': {
    name: 'GeneralData1',
    fields: ['ERPM', 'DutyCycle', 'InputVoltage'],
    encoding: {
      ERPM:         { bytes: [0,1,2,3], type: 'int32be', scale: 1,   unit: 'ERPM', note: 'Electrical RPM = Motor RPM * pole pairs' },
      DutyCycle:    { bytes: [4,5],     type: 'int16be', scale: 0.1, unit: '%',    note: '+ running, - regen' },
      InputVoltage: { bytes: [6,7],     type: 'int16be', scale: 1,   unit: 'V',    note: 'DC bus voltage' },
    }
  },
  '0x212c': {
    name: 'GeneralData2',
    fields: ['ACCurrent', 'DCCurrent'],
    encoding: {
      ACCurrent: { bytes: [0,1], type: 'int16be', scale: .10, unit: 'Apk', note: '+ running, - regen' },
      DCCurrent: { bytes: [2,3], type: 'int16be', scale: .10, unit: 'Adc', note: '+ running, - regen' },
    }
  },
  '0x222c': {
    name: 'GeneralData3',
    fields: ['ControllerTemp', 'MotorTemp', 'FaultCode'],
    encoding: {
      ControllerTemp: { bytes: [0,1], type: 'int16be', scale: 0.1, unit: '°C', note: 'Inverter semiconductor temp' },
      MotorTemp:      { bytes: [2,3], type: 'int16be', scale: 0.1, unit: '°C', note: 'Motor temp via inverter' },
      FaultCode:      { bytes: [4],   type: 'uint8',   scale: 1,   unit: '#',  note: '0=None 1=Overvolt 2=Undervolt 3=DRV 4=Overcurrent 5=CTLR Overtemp 6=Motor Overtemp 7=Sensor wire 8=Sensor general 9=CAN cmd error 0xA=Analog input error' },
    }
  },
  '0x232c': {
    name: 'GeneralData4',
    fields: ['Id', 'Iq'],
    encoding: {
      Id: { bytes: [0,1,2,3], type: 'int32be', scale: 0.01, unit: 'Apk', note: 'FOC d-axis current' },
      Iq: { bytes: [4,5,6,7], type: 'int32be', scale: 0.01, unit: 'Apk', note: 'FOC q-axis current' },
    }
  },
  '0x242c': {
    name: 'GeneralData5',
    fields: ['Throttle', 'Brake', 'DigitalInputs', 'DigitalOutputs', 'DriveEnable', 'LimitFlags', 'CANMapVersion'],
    encoding: {
      Throttle:       { bytes: [0],   type: 'int8',   scale: 1, unit: '%', note: 'From analog input or CAN2; -128 to 127' },
      Brake:          { bytes: [1],   type: 'int8',   scale: 1, unit: '%', note: 'From analog input or CAN2; -128 to 127' },
      DigitalInputs:  { bytes: [2],   type: 'uint8',  scale: 1, unit: '#', note: 'Bits 0-3: DI1-DI4 (1=active)',
        bits: { 0: 'DI1', 1: 'DI2', 2: 'DI3', 3: 'DI4' }
      },
      DigitalOutputs: { bytes: [2],   type: 'uint8',  scale: 1, unit: '#', note: 'Bits 4-7: DO1-DO4 (1=active)',
        bits: { 4: 'DO1', 5: 'DO2', 6: 'DO3', 7: 'DO4' }
      },
      DriveEnable:    { bytes: [3],   type: 'uint8',  scale: 1, unit: '#', note: '1=drive enabled, 0=disabled' },
      LimitFlags:     { bytes: [4,5], type: 'uint16', scale: 1, unit: '#', note: 'Active inverter limits',
        bits: {
          0: 'Cap Temp',
          1: 'DC Current',
          2: 'Drive Enable',
          3: 'IGBT Accel Temp',
          4: 'IGBT Temp',
          5: 'Input Voltage',
          6: 'Motor Accel Temp',
          7: 'Motor Temp',
          8: 'RPM Min',
          9: 'RPM Max',
          10: 'Power Limit',
        }
      },
      CANMapVersion:  { bytes: [7],   type: 'uint8',  scale: 1, unit: '#', note: 'e.g. 25 → v2.5' },
    }
  },
  '0x1f2c': {
    name: 'GeneralData6',
    fields: ['ControlMode', 'TargetIq', 'MotorPosition', 'isMotorStill'],
    encoding: {
      ControlMode:   { bytes: [0],   type: 'uint8',   scale: 1,   unit: '#',   note: '1=Speed 2=Current 3=CurrentBrake 4=Position 7=None' },
      TargetIq:      { bytes: [1,2], type: 'int16be', scale: 0.1, unit: 'Apk', note: 'Target Iq current, excludes limits' },
      MotorPosition: { bytes: [3,4], type: 'int16be', scale: 0.1, unit: '°',   note: 'Motor position in degrees (0-359)' },
      isMotorStill:  { bytes: [5],   type: 'uint8',   scale: 1,   unit: '#',   note: '1=still, 0=rotating' },
    }
  },
  '0x252c': {
    name: 'ACCurrentLimits',
    fields: ['MaxACCurrent', 'AvMaxACCurrent', 'MinACCurrent', 'AvMinACCurrent'],
    encoding: {
      MaxACCurrent:   { bytes: [0,1], type: 'int16be', scale: 0.1, unit: 'Apk', note: 'Configured max AC current' },
      AvMaxACCurrent: { bytes: [2,3], type: 'int16be', scale: 0.1, unit: 'Apk', note: 'Available max AC current (derated by limits)' },
      MinACCurrent:   { bytes: [4,5], type: 'int16be', scale: 0.1, unit: 'Apk', note: 'Configured min AC current' },
      AvMinACCurrent: { bytes: [6,7], type: 'int16be', scale: 0.1, unit: 'Apk', note: 'Available min AC current (derated by limits)' },
    }
  },
  '0x262c': {
    name: 'DCCurrentLimits',
    fields: ['MaxDCCurrent', 'AvMaxDCCurrent', 'MinDCCurrent', 'AvMinDCCurrent'],
    encoding: {
      MaxDCCurrent:   { bytes: [0,1], type: 'int16be', scale: 0.1, unit: 'Adc', note: 'Configured max DC current' },
      AvMaxDCCurrent: { bytes: [2,3], type: 'int16be', scale: 0.1, unit: 'Adc', note: 'Available max DC current (derated by limits)' },
      MinDCCurrent:   { bytes: [4,5], type: 'int16be', scale: 0.1, unit: 'Adc', note: 'Configured min DC current' },
      AvMinDCCurrent: { bytes: [6,7], type: 'int16be', scale: 0.1, unit: 'Adc', note: 'Available min DC current (derated by limits)' },
    }
  },

  // ---------------------------------------------------------------------------
  // BMS (Orion BMS 2)
  // ---------------------------------------------------------------------------
  '0x60': {
    name: 'BMS_Telemetry',
    fields: ['RelayState', 'FailsafeStatus', 'DTC_Status1', 'DTC_Status2'],
    encoding: {
      RelayState: {
        bytes: [0,1], type: 'uint16', scale: 1, unit: '#',
        note: 'Relay and I/O signal states',
        bits: {
          0:  'Discharge relay',
          1:  'Charge relay',
          2:  'Charger safety',
          3:  'Malfunction indicator',
          4:  'MP Input',
          5:  'Always-on',
          6:  'Is-Ready',
          7:  'Is-Charging',
          8:  'MP Input #2',
          9:  'MP Input #3',
          10: 'Charge Mode',
          11: 'MP Output #2',
          12: 'MP Output #3',
          13: 'MP Output #4',
          14: 'MP Enable',
          15: 'MP Output #1',
        }
      },
      FailsafeStatus: {
        bytes: [2,3], type: 'uint16', scale: 1, unit: '#',
        note: 'Active failsafe conditions',
        bits: {
          0:  'Voltage failsafe',
          1:  'Current failsafe',
          2:  'Relay failsafe',
          3:  'Cell balancing',
          4:  'Charge interlock',
          5:  'Thermistor B-value invalid',
          6:  'Input power failsafe',
          8:  'Contactors opened under load',
          12: 'Polarization model 1',
          13: 'Polarization model 2',
          14: 'Polarization comp inactive',
          15: 'Charge Mode via CAN',
        }
      },
      DTC_Status1: {
        bytes: [4,5], type: 'uint16', scale: 1, unit: '#',
        note: 'DTC fault codes group 1',
        bits: {
          0: 'P0A07 Discharge Limit',
          1: 'P0A08 Charger Safety Relay',
          2: 'P0A09 Internal Hardware',
          3: 'P0A0A Internal Heatsink',
          4: 'P0A0B Internal Software',
          5: 'P0A0C Cell Voltage High',
          6: 'P0A0E Cell Voltage Low',
          7: 'P0A10 Pack Too Hot',
          8: 'P0A95 HV Interlock',
          9: 'P0AA1 Precharge',
          10: 'P0A11 Abnormal SOC',
        }
      },
      DTC_Status2: {
        bytes: [6,7], type: 'uint16', scale: 1, unit: '#',
        note: 'DTC fault codes group 2',
        bits: {
          0: 'P0A1F Internal Comm',
          1: 'P0A12 Cell Balancing Stuck',
          2: 'P0A80 Weak Cell',
          3: 'P0AFA Low Cell Voltage',
          4: 'P0A04 Open Wiring',
          5: 'P0AC0 Current Sensor',
          6: 'P0A0D Cell Voltage Over 5V',
          7: 'P0A0F Cell ASIC',
          8: 'P0A02 Weak Pack',
          9: 'P0A81 Fan Monitor',
          10: 'P0A9C Thermistor',
          11: 'U0100 External Comm',
          12: 'P0560 Redundant Power',
          13: 'P0AA6 HV Isolation',
          14: 'P0A05 Input Power',
          15: 'P0A06 Charge Limit',
        }
      }
    }
  },
  '0x61': {
    name: 'BMS_CellVoltages',
    fields: ['LowCellVoltage', 'HighCellVoltage', 'AvgCellVoltage', 'HighID', 'LowID'],
    encoding: {
      LowCellVoltage:  { bytes: [0,1], type: 'uint16', scale: 0.0001, unit: 'V', note: 'Lowest cell voltage' },
      HighCellVoltage: { bytes: [2,3], type: 'uint16', scale: 0.0001, unit: 'V', note: 'Highest cell voltage' },
      AvgCellVoltage:  { bytes: [4,5], type: 'uint16', scale: 0.0001, unit: 'V', note: 'Average cell voltage' },
      HighID:          { bytes: [6],   type: 'uint8',  scale: 1,      unit: '#', note: 'Highest cell ID' },
      LowID:           { bytes: [7],   type: 'uint8',  scale: 1,      unit: '#', note: 'Lowest cell ID' },
    }
  },

  // ---------------------------------------------------------------------------
  // Radio status (ESP32 receiver)
  // ---------------------------------------------------------------------------
  '0x31': {
    name: 'RadioStatus',
    fields: ['Opcode', 'RSSI'],
    encoding: {
      Opcode: { bytes: [0,1], type: 'int16be', scale: 1,   unit: '#',   note: 'RadioLib state code. 0 = OK' },
      RSSI:   { bytes: [2,3], type: 'int16be', scale: 0.1, unit: 'dBm', note: 'Signal strength × 10' },
    }
  },

  // ---------------------------------------------------------------------------
  // other important need to record messages
  // ---------------------------------------------------------------------------

  '0x52C': {
    name: 'Pedalbox',
    fields: ['ACCurrent'],
    encoding: {
      ACCurrent: { 
        bytes: [0, 1], 
        type: 'int16be', 
        scale: 1, // Assumed 1 unless it needs a decimal multiplier
        unit: '%', 
        note: 'Relays accelerator press. Sent every 10ms. Bytes 2–7 are 0xFF.' 
      }
    }
  },
  '0x7FE': {
    name: 'Dashboard',
    fields: ['RTD'],
    encoding: {
      RTD: { 
        bytes: [0], 
        type: 'uint8', 
        scale: 1, 
        unit: '#', 
        note: 'Ready-To-Drive status. Sent 5 times on press. 0x01 = Active. Bytes 17 are 0xFF.' 
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Bitfield pill display
// ---------------------------------------------------------------------------
const BitfieldDisplay = ({ raw, bits }) => {
  if (raw === null || raw === undefined) {
    return <span style={{ color: '#666', fontSize: '10px' }}>N/A</span>;
  }

  const bitIndices = Object.keys(bits).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
      {bitIndices.map(bit => {
        const active = ((raw >> bit) & 1) === 1;
        return (
          <div
            key={bit}
            title={`Bit ${bit}: ${bits[bit]}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              background: active ? '#1b3a1b' : '#2a2a2a',
              border: `1px solid ${active ? '#4caf50' : '#444'}`,
              borderRadius: '3px',
              padding: '2px 5px',
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: active ? '#4caf50' : '#555',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '8px', color: active ? '#b9f0b9' : '#666', whiteSpace: 'nowrap' }}>
              {bits[bit]}
            </span>
          </div>
        );
      })}
      <div style={{ fontSize: '8px', color: '#555', alignSelf: 'center', marginLeft: '2px' }}>
        0x{raw.toString(16).toUpperCase().padStart(4, '0')}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Decoder
// ---------------------------------------------------------------------------
const decodeFieldValue = (buffer, encoding) => {
  const { bytes, type } = encoding;
  if (!bytes || bytes.length === 0 || Math.max(...bytes) >= buffer.length) return null;

  const selected = new Uint8Array(bytes.map(pos => buffer[pos]));
  const view = new DataView(selected.buffer);

  switch (type) {
    case 'int32be':   return selected.length < 4 ? null : view.getInt32(0, false);
    case 'uint32':
    case 'uint32be':  return selected.length < 4 ? null : view.getUint32(0, false);
    case 'int16be':   return selected.length < 2 ? null : view.getInt16(0, false);
    case 'uint16':
    case 'uint16be':  return selected.length < 2 ? null : view.getUint16(0, false);
    case 'int8':      return view.getInt8(0);
    case 'uint8':     return view.getUint8(0);
    default: {
      let value = 0;
      selected.forEach(b => { value = value * 256 + b; });
      return value;
    }
  }
};

// ---------------------------------------------------------------------------
// Global state hook
// ---------------------------------------------------------------------------
const useCANData = () => {
  const [canData, setCANData] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(false);

  const initializeCANData = () => {
    const initialData = {};
    Object.keys(CAN_MESSAGE_TYPES).forEach(id => {
      const message = CAN_MESSAGE_TYPES[id];
      initialData[id] = { id, name: message.name, timestamp: null, fields: {} };
      message.fields.forEach(field => { initialData[id].fields[field] = null; });
    });
    return initialData;
  };

  useEffect(() => { setCANData(initializeCANData()); }, []);

  const parseCANMessage = (rawMessage) => {
    try {
      const message = rawMessage.trim();
      if (!message || message.startsWith('CXX')) return null;

      let dataPart = message;
      let timestamp = new Date().toISOString();

      const tsMatch = message.match(/^(\d+\.\d+)\s+/);
      if (tsMatch) {
        timestamp = tsMatch[1];
        dataPart = message.slice(tsMatch[0].length);
      }

      const parts = dataPart.trim().split(/\s+/);
      if (parts.length < 2) return null;

      let startIndex = 0;
      if (/^\d?[RT]\d{2}$/.test(parts[0])) {
        startIndex = 1;
      }

      const rawId = parts[startIndex];
      const idNum = parseInt(rawId, 16);
      if (isNaN(idNum)) return null;

      // DTI inverter uses extended ID (R29): PacketID << 8 | NodeID
      // Strip the node ID to get the packet ID we match against
      const frameType = parts[0]; // e.g. "R29", "R11"
      const isExtended = frameType === 'R29' || frameType === '2R29';
      const packetNum = isExtended ? (idNum >> 8) : idNum;
      const id = '0x' + packetNum.toString(16);

    // Some logs include DLC after ID (e.g. "... 020 8 00 11 ..."), others don't.
    const payloadTokens = parts.slice(startIndex + 1);
    let dataTokenStart = 0;
    if (payloadTokens.length > 0) {
      const maybeDlc = payloadTokens[0];
      const dlcNum = /^\d+$/.test(maybeDlc)
        ? parseInt(maybeDlc, 10)
        : (/^[0-9a-fA-F]+$/.test(maybeDlc) ? parseInt(maybeDlc, 16) : NaN);

      // Treat first payload token as DLC only when it's a decimal number (1-64) 
      // or a hex value that matches expected byte count.
      // Exclude '00' since it's commonly a valid data byte, not DLC.
      if (!Number.isNaN(dlcNum) && dlcNum > 0 && dlcNum <= 64 && 
          // /^\d+$/.test(maybeDlc) && payloadTokens.length - 1 >= dlcNum) {
          /^\d+$/.test(maybeDlc) && payloadTokens.length - 1 === dlcNum) {
        dataTokenStart = 1;
      }
    }

      const dataBytes = payloadTokens
        .slice(dataTokenStart)
        .filter(token => /^[0-9a-fA-F]{1,2}$/.test(token));

      if (!CAN_MESSAGE_TYPES[id] || dataBytes.length === 0) {
        console.warn('Unknown CAN ID:', id);
        return null;
      }
      if (!CAN_MESSAGE_TYPES[id] || dataBytes.length === 0) {
        console.warn('Unknown CAN ID:', id);
        return null;
      }

      const messageConfig = CAN_MESSAGE_TYPES[id];
      const dataBuffer = new Uint8Array(dataBytes.map(b => parseInt(b, 16)));

    const decodeFieldValue = (buffer, encoding) => {
      const { bytes, type } = encoding;
      if (!bytes || bytes.length === 0 || Math.max(...bytes) >= buffer.length) {
        return null;
      }

      const selected = new Uint8Array(bytes.map(pos => buffer[pos]));
      const view = new DataView(selected.buffer);

      switch (type) {
        case 'int32be':
          if (selected.length < 4) return null;
          return view.getInt32(0, false);
        case 'uint32':
        case 'uint32be':
          if (selected.length < 4) return null;
          return view.getUint32(0, false);
        case 'int16be':
          if (selected.length < 2) return null;
          return view.getInt16(0, false);
        case 'uint16':
        case 'uint16be':
          if (selected.length < 2) return null;
          return view.getUint16(0, false);
        case 'int8':
          return view.getInt8(0);
        case 'uint8':
          return view.getUint8(0);
        default: {
          // Fallback for unknown type: big-endian unsigned aggregation.
          let value = 0;
          selected.forEach(b => { value = value * 256 + b; });
          return value;
        }
      }
    };

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

      const { scale, unit } = encoding;
      const raw = decodeFieldValue(dataBuffer, encoding);
      if (raw === null) {
        parsedData.fields[fieldName] = { value: null, unit, raw: null };
        return;
      }

      const value = Math.round(raw * (scale ?? 1) * 10000) / 10000;
      parsedData.fields[fieldName] = { value, unit, raw };
    });

      return parsedData;

    } catch (error) {
      console.error('Error parsing CAN message:', error, rawMessage);
      return null;
    }
  };

  const handleSerialData = (data) => {
    const message = data.toString();
    const parsedMessage = parseCANMessage(message);
    if (parsedMessage) {
      setCANData(prev => ({
        ...prev,
        [parsedMessage.id]: parsedMessage
      }));
      setLastUpdate(new Date());
    }
  };

  const handleConnectionStatus = (status) => {
    setConnectionStatus(status);
  };

  return { canData, lastUpdate, connectionStatus, handleSerialData, handleConnectionStatus, CAN_MESSAGE_TYPES };
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const InfoProcProvider = ({ children, isRunning = true }) => {
  const canData = useCANData();

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not available in InfoProc');
      return;
    }

    let cleanupData = null;
    let cleanupStatus = null;

    if (window.electronAPI.onSerialData) {
      cleanupData = window.electronAPI.onSerialData((data) => {
        if (!isRunning) return;
        canData.handleSerialData(data);
      });
    }
    if (window.electronAPI.onSerialConnectionStatus) {
      cleanupStatus = window.electronAPI.onSerialConnectionStatus(canData.handleConnectionStatus);
    }

    return () => {
      if (cleanupData) cleanupData();
      if (cleanupStatus) cleanupStatus();
    };
  }, [canData.handleSerialData, canData.handleConnectionStatus, isRunning]);

  return (
    <CANDataContext.Provider value={canData}>
      {children}
    </CANDataContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export const useCANDataHook = () => {
  const context = useContext(CANDataContext);
  if (!context) throw new Error('useCANDataHook must be used within a InfoProcProvider');
  return context;
};

// ---------------------------------------------------------------------------
// Debugger UI
// ---------------------------------------------------------------------------
export const CANDataDebugger = () => {
  const { canData, lastUpdate, connectionStatus, CAN_MESSAGE_TYPES } = useCANDataHook();
  const [hoveredField, setHoveredField] = useState(null);

  const handleFieldHover = (fieldName, encoding) => {
    setHoveredField({
      fieldName,
      note:  encoding?.note  ?? '',
      type:  encoding?.type  ?? '',
      bytes: encoding?.bytes ?? [],
    });
  };

  const handleFieldLeave = () => setHoveredField(null);

  return (
    <div className="can-data-debugger" style={{
      background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
      padding: '10px', color: '#fff', fontFamily: 'monospace', fontSize: '12px',
      margin: '10px 0', position: 'relative',
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#4caf50' }}>
        motor inverter CAN Data Parser
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
              // Bitfield fields get full width; regular fields share 3 columns
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '3px',
              maxHeight: '500px',
              overflow: 'auto',
              paddingRight: '4px',
            }}>
              {messageConfig.fields.map(fieldName => {
                const fieldData = message.fields[fieldName];
                const encoding = messageConfig.encoding[fieldName];
                const isBitfield = encoding && encoding.bits;
                const unit = encoding ? encoding.unit : '';
                const scale = encoding ? encoding.scale : 1;
                const rawValue = fieldData && fieldData.raw !== null ? fieldData.raw : null;
                const scaledValue = fieldData && fieldData.value !== null ? fieldData.value : null;

                // Bitfield fields span all 3 columns
                const gridStyle = isBitfield ? { gridColumn: '1 / -1' } : {};

                return (
                  <div
                    key={fieldName}
                    style={{
                      background: '#2a2a2a',
                      padding: '4px',
                      borderRadius: '3px',
                      cursor: encoding && encoding.note ? 'help' : 'default',
                      position: 'relative',
                      minHeight: isBitfield ? 'auto' : '35px',
                      fontSize: '10px',
                      ...gridStyle
                    }}
                    onMouseEnter={() => !isBitfield && encoding?.note && handleFieldHover(fieldName, encoding)}
                    onMouseLeave={handleFieldLeave}
                  >
                    {/* Field name */}
                    <div style={{
                      fontSize: '8px',
                      color: '#888',
                      marginBottom: '1px',
                      fontWeight: 'bold',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {fieldName}
                      {isBitfield && encoding?.note && (
                        <span style={{ fontWeight: 'normal', marginLeft: '6px', color: '#555' }}>
                          — {encoding.note}
                        </span>
                      )}
                    </div>

                    {isBitfield ? (
                      <BitfieldDisplay raw={rawValue} bits={encoding.bits} />
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                          <div style={{ fontSize: '8px', color: '#666', fontFamily: 'monospace', flexShrink: 0 }}>
                            {rawValue !== null ? `${rawValue} × ${scale}` : 'N/A'}
                          </div>
                          <div style={{
                            fontSize: '14px', fontWeight: 'bold',
                            color: scaledValue !== null ? '#fff' : '#666',
                            flex: 1, textAlign: 'right',
                          }}>
                            {scaledValue !== null ? scaledValue : 'N/A'}
                          </div>
                          <div style={{ fontSize: '9px', color: '#aaa', fontWeight: 'normal', flexShrink: 0 }}>
                            {unit}
                          </div>
                        </div>

                        {encoding?.note && (
                          <div style={{
                            fontSize: '7px', color: '#888', marginTop: '1px',
                            lineHeight: '1.1', maxHeight: '15px', overflow: 'hidden',
                            textOverflow: 'ellipsis', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {encoding.note}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Hover popup (non-bitfield only) */}
      {hoveredField && (
        <div
          style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#2a2a2a', border: '1px solid #666',
            borderRadius: '6px', padding: '15px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1000, minWidth: '300px', maxWidth: '400px',
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
          {hoveredField.bytes?.length > 0 && (
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