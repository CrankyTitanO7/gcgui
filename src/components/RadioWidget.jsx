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

  // Signal strength color and description mapping
  const getSignalStrength = (rssiValue) => {
    if (rssiValue === null || rssiValue === undefined) {
      return { color: '#666', level: 'No Signal', percentage: 0 };
    }
    
    // Convert to absolute value for comparison (RSSI is negative in dBm)
    const absRssi = Math.abs(rssiValue);
    
    // Thresholds based on provided values (30, 50, 60, 67, 70, 80, 90)
    if (absRssi <= 30) {
      return { color: '#00e676', level: 'Excellent', percentage: 100 };
    } else if (absRssi <= 50) {
      return { color: '#4caf50', level: 'Very Good', percentage: 85 };
    } else if (absRssi <= 60) {
      return { color: '#8bc34a', level: 'Good', percentage: 70 };
    } else if (absRssi <= 67) {
      return { color: '#ffeb3b', level: 'Fair', percentage: 55 };
    } else if (absRssi <= 70) {
      return { color: '#ffc107', level: 'Marginal', percentage: 40 };
    } else if (absRssi <= 80) {
      return { color: '#ff9800', level: 'Weak', percentage: 25 };
    } else if (absRssi <= 90) {
      return { color: '#f44336', level: 'Very Weak', percentage: 10 };
    } else {
      return { color: '#b71c1c', level: 'No Signal', percentage: 0 };
    }
  };

  const signalInfo = getSignalStrength(rssi);

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
                <span className="rssi-value" style={{ color: signalInfo.color }}>{rssi}</span>
                <span className="rssi-unit">dBm</span>
                <div className="signal-strength-container">
                  <div 
                    className="signal-strength-bar"
                    style={{ 
                      width: `${signalInfo.percentage}%`,
                      backgroundColor: signalInfo.color
                    }}
                  />
                  <div className="signal-tooltip">
                    <div className="tooltip-title">Signal Strength</div>
                    <div className="tooltip-level" style={{ color: signalInfo.color }}>{signalInfo.level}</div>
                    <div className="tooltip-info">RSSI: {rssi} dBm</div>
                    <div className="tooltip-scale">
                      <span>30</span>
                      <span>50</span>
                      <span>60</span>
                      <span>67</span>
                      <span>70</span>
                      <span>80</span>
                      <span>90</span>
                    </div>
                    <div className="tooltip-desc">-dBm thresholds</div>
                  </div>
                </div>
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