import React, { useState, useEffect } from 'react';
import './RawSerialWidget.css';

const RawSerialWidget = () => {
  const [rawData, setRawData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Listen for serial data from main process
    if (window.electron && window.electron.ipcRenderer) {
      const handleSerialData = (event, data) => {
        setIsConnected(true);
        // Add timestamp and limit to last 100 lines
        const timestamp = new Date().toLocaleTimeString();
        const newData = { timestamp, data: data.toString() };
        
        setRawData(prev => {
          const updated = [...prev, newData];
          return updated.slice(-100); // Keep only last 100 lines
        });
      };

      window.electron.ipcRenderer.on('serial-data', handleSerialData);

      // Listen for connection status
      const handleConnectionStatus = (event, status) => {
        setIsConnected(status);
      };

      window.electron.ipcRenderer.on('serial-connection-status', handleConnectionStatus);

      return () => {
        window.electron.ipcRenderer.off('serial-data', handleSerialData);
        window.electron.ipcRenderer.off('serial-connection-status', handleConnectionStatus);
      };
    }
  }, []);

  const clearData = () => {
    setRawData([]);
  };

  return (
    <div className="raw-serial-widget fill">
      <div className="widget-header">
        <div className="widget-name">Raw Serial Data</div>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>
      
      <div className="raw-data-container">
        <div className="raw-data-header">
          <span>Time</span>
          <span>Data</span>
          <button className="clear-button" onClick={clearData} title="Clear data">
            Clear
          </button>
        </div>
        
        <div className="raw-data-content">
          {rawData.length === 0 ? (
            <div className="no-data">No data received yet...</div>
          ) : (
            rawData.map((item, index) => (
              <div key={index} className="raw-data-line">
                <span className="timestamp">{item.timestamp}</span>
                <span className="data-value">{item.data}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RawSerialWidget;