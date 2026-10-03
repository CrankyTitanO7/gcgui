import React, { useState, useEffect, useRef } from 'react';
import { CLEAR_ALL_EVENT } from '../utils/clearAll';
import './RawSerialWidget.css';

const RawSerialWidget = ({ isRunning = true, dataSource = 'live' }) => {
  const [rawData, setRawData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const contentRef = useRef(null);
  const [replayProgress, setReplayProgress] = useState({ current: 0, total: 0, duration: 0, currentTime: 0 });

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not available');
      return;
    }

    let cleanupData = null;
    let cleanupStatus = null;
    let cleanupReplayStatus = null;

    // Listen for serial data - always listening, even when not recording.
    // In live mode the topbar button only controls file recording.
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

    // Listen for replay status
    if (window.electronAPI.onReplayStatus) {
      cleanupReplayStatus = window.electronAPI.onReplayStatus((status) => {
        console.log('Replay status:', status); // Debug log
        if (status.currentIndex !== undefined) {
          setReplayProgress(prev => ({ ...prev, current: status.currentIndex }));
        }
        if (status.completed) {
          setReplayProgress(prev => ({ ...prev, current: prev.total }));
        }
      });
    }

    // Get initial replay status
    if (dataSource === 'log' && window.electronAPI.getReplayStatus) {
      window.electronAPI.getReplayStatus().then(status => {
        if (status.ok) {
          setReplayProgress({
            current: status.currentIndex || 0,
            total: status.totalMessages || 0,
            duration: status.duration || 0,
            currentTime: status.currentTime || 0
          });
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (cleanupData) cleanupData();
      if (cleanupStatus) cleanupStatus();
      if (cleanupReplayStatus) cleanupReplayStatus();
    };
  }, [dataSource]);

  const clearData = () => {
    setRawData([]);
  };

  useEffect(() => {
    const handleClearAll = () => setRawData([]);
    window.addEventListener(CLEAR_ALL_EVENT, handleClearAll);
    return () => window.removeEventListener(CLEAR_ALL_EVENT, handleClearAll);
  }, []);

  // Stick to the bottom on new lines while autoscroll is locked on.
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [rawData, autoScroll]);

  return (
    <div className="raw-serial-widget fill">
      <div className="widget-header">
        <div className="widget-name">Raw Serial Data</div>
        <div className={`connection-status ${dataSource === 'log' ? 'replaying' : isConnected ? 'connected' : 'disconnected'}`}>
          {dataSource === 'log' 
            ? (isRunning ? '▶ Replaying' : '⏸ Paused')
            : isConnected 
              ? '● Connected' 
              : '○ Disconnected'}
        </div>
      </div>

      {/* Replay Timeline */}
      {dataSource === 'log' && replayProgress.total > 0 && (
        <div className="replay-timeline">
          <div className="timeline-bar">
            <div 
              className="timeline-progress" 
              style={{ width: `${(replayProgress.current / replayProgress.total) * 100}%` }}
            />
          </div>
          <div className="timeline-info">
            <span>{replayProgress.current} / {replayProgress.total} messages</span>
            <span>{((replayProgress.current / replayProgress.total) * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
      
      <div className="raw-data-container">
        <div className="raw-data-header">
          <span>Time</span>
          <span>Data</span>
          <button
            className={`lock-button ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(v => !v)}
            title={autoScroll ? 'Autoscroll locked to bottom (click to unlock)' : 'Autoscroll unlocked (click to lock to bottom)'}
          >
            {autoScroll ? '🔒 Lock' : '🔓'}
          </button>
          <button className="clear-button" onClick={clearData} title="Clear data">
            Clear
          </button>
        </div>
        
        <div className="raw-data-content" ref={contentRef}>
          {rawData.length === 0 ? (
            <div className="no-data">
              {dataSource === 'log'
                ? (!isRunning ? 'Paused - Click Start to replay' : 'Waiting for replay data...')
                : !isConnected
                  ? 'No data received yet...'
                  : 'Listening… Waiting for data...'}
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