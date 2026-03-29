import { useCANDataHook } from './infoProc';

function BMSStatusWidget({ shape }) {
  const { canData } = useCANDataHook();
  const bms = canData['0x60'];

  const fields = ['RelayState', 'FailsafeStatus', 'DTC_Status1', 'DTC_Status2'];

  const bitLabels = {
    RelayState:     { 0: 'Discharge relay', 1: 'Charge relay', 2: 'Charger safety', 3: 'Malfunction', 6: 'Is-Ready', 7: 'Is-Charging' },
    FailsafeStatus: { 0: 'Voltage', 1: 'Current', 2: 'Relay', 3: 'Cell balancing', 4: 'Charge interlock', 6: 'Input power' },
    DTC_Status1:    { 0: 'P0A07', 1: 'P0A08', 2: 'P0A09', 4: 'P0A0B', 5: 'P0A0C Cell Hi', 6: 'P0A0E Cell Lo', 7: 'P0A10 Overheat' },
    DTC_Status2:    { 3: 'P0AFA Low Cell', 4: 'P0A04 Wiring', 5: 'P0AC0 Current Sensor', 10: 'P0A9C Thermistor', 11: 'U0100 Comm' },
  };

  const sectionColors = {
    RelayState:     '#2196f3',
    FailsafeStatus: '#ff9800',
    DTC_Status1:    '#f44336',
    DTC_Status2:    '#f44336',
  };

  return (
    <div className="fill" style={{ padding: '8px', overflowY: 'auto', fontFamily: 'monospace' }}>
      <div className="widget-name">{shape.name}</div>

      {!bms || !bms.fields ? (
        <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>No BMS data</div>
      ) : (
        fields.map(fieldName => {
          const fieldData = bms.fields[fieldName];
          const raw = fieldData ? fieldData.raw : null;
          const bits = bitLabels[fieldName] || {};
          const color = sectionColors[fieldName];
          const activeBits = Object.keys(bits).filter(bit => raw !== null && ((raw >> Number(bit)) & 1) === 1);

          return (
            <div key={fieldName} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', color, fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em' }}>
                {fieldName}
                <span style={{ color: '#555', fontWeight: 'normal', marginLeft: '6px' }}>
                  {raw !== null ? `0x${raw.toString(16).toUpperCase().padStart(4,'0')}` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {Object.entries(bits).map(([bit, label]) => {
                  const active = raw !== null && ((raw >> Number(bit)) & 1) === 1;
                  return (
                    <div key={bit} style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '9px',
                      background: active ? (fieldName === 'RelayState' ? '#1a3a1a' : '#3a1a1a') : '#222',
                      border: `1px solid ${active ? (fieldName === 'RelayState' ? '#4caf50' : '#f44336') : '#333'}`,
                      color: active ? (fieldName === 'RelayState' ? '#81c784' : '#ef9a9a') : '#555',
                    }}>
                      {label}
                    </div>
                  );
                })}
                {activeBits.length === 0 && (
                  <span style={{ fontSize: '9px', color: '#444' }}>all clear</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default BMSStatusWidget;
