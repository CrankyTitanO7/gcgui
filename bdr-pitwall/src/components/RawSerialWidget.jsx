import React, { useState, useEffect } from 'react';
import './RawSerialWidget.css';

const RawSerialWidget = () => {
  const [rawData, setRawData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not available');
      return;
    }

    let cleanupData = null;
    let cleanupStatus = null;

    // Listen for serial data
    if (window.electronAPI.onSerialData) {
      cleanupData = window.electronAPI.onSerialData((data) => {
        console.log('Serial data received:', data); // Debug log
        const timestamp = new Date().toLocaleTimeString();
        const newData = { timestamp, data: data.toString() };
        
        setRawData(prev => {
          const updated = [...prev, newData];
          return updated.slice(-100); // Keep only last 100 lines
        });
      });
    }

    // Listen for connection status
    if (window.electronAPI.onSerialConnectionStatus) {
      cleanupStatus = window.electronAPI.onSerialConnectionStatus((status) => {
        console.log('Connection status:', status); // Debug log
        setIsConnected(status);
      });
    }

    // Cleanup on unmount
    return () => {
      if (cleanupData) cleanupData();
      if (cleanupStatus) cleanupStatus();
    };
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
            <div className="no-data">
              {isConnected ? 'Waiting for data...' : 'No data received yet...'}
            </div>
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