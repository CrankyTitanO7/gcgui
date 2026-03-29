import { useCANDataHook } from './infoProc';
import './RadioWidget.css';

const RadioWidget = () => {
  const { canData, connectionStatus } = useCANDataHook();
  
  // Get radio status data (CAN ID 0x31)
  const radioData = canData['0x31'];
  const opcode = radioData?.fields?.Opcode?.value;
  const rssi = radioData?.fields?.RSSI?.value;
  const rssiRaw = radioData?.fields?.RSSI?.raw;
  const rssiScale = 0.1; // RSSI scaling factor

  return (
    <div className="radio-widget">
      <div className="widget-header">
        <div className="widget-name">Radio Status</div>
        <div className={`connection-status ${connectionStatus ? 'connected' : 'disconnected'}`}>
          {connectionStatus ? '● Connected' : '○ Disconnected'}
        </div>
      </div>
      
      <div className="radio-data">
        <div className="data-field">
          <div className="field-label">Opcode</div>
          <div className="field-value">
            {opcode !== null && opcode !== undefined ? (
              <span className="opcode-value">{opcode}</span>
            ) : (
              <span className="no-data">N/A</span>
            )}
          </div>
          <div className="field-info">RadioLib state code (0 = OK)</div>
        </div>
        
        <div className="data-field">
          <div className="field-label">RSSI</div>
          <div className="field-value">
            {rssi !== null && rssi !== undefined ? (
              <>
                <span className="rssi-value">{rssi}</span>
                <span className="rssi-unit">dBm</span>
              </>
            ) : (
              <span className="no-data">N/A</span>
            )}
          </div>
          <div className="field-info">
            {rssiRaw !== null && rssiRaw !== undefined ? (
              <>Raw: {rssiRaw} × {rssiScale}</>
            ) : (
              <>Signal strength</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RadioWidget;