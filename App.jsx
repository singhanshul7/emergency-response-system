import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const App = () => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const socket = useRef(null);
  const markerLayer = useRef(null);
  const processedIds = useRef(new Set());

  const [incident, setIncident] = useState(null);
  const [isSystemOn, setIsSystemOn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [uplinkSpeed, setUplinkSpeed] = useState(940);
  
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('sentinel_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const JABALPUR_HQ = [23.1815, 79.9864];

  // --- NEW FEATURE: ETA & DISTANCE CALCULATION ---
  const calculateMetrics = (lat, lng) => {
    const dist = (Math.sqrt(Math.pow(lat - JABALPUR_HQ[0], 2) + Math.pow(lng - JABALPUR_HQ[1], 2)) * 111).toFixed(1);
    const eta = Math.ceil(dist * 2.2 + 3); // 2.2 mins per km + buffer
    const severity = dist < 4 ? 'CRITICAL' : dist < 7 ? 'HIGH' : 'STABLE';
    return { dist, eta, severity };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
      if (isSystemOn) setUplinkSpeed(Math.floor(Math.random() * (998 - 920) + 920));
    }, 1000);

    // Leaflet Setup
    if (!document.getElementById('l-css')) {
      const link = document.createElement('link');
      link.id = 'l-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      if (!leafletMap.current && window.L) {
        leafletMap.current = window.L.map(mapRef.current, { zoomControl: false }).setView(JABALPUR_HQ, 13);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(leafletMap.current);
        markerLayer.current = window.L.layerGroup().addTo(leafletMap.current);
      }
    };
    document.head.appendChild(script);

    socket.current = io('http://localhost:5000');

    socket.current.on('receive_emergency', (data) => {
      if (!processedIds.current.has(data.id)) {
        processedIds.current.add(data.id);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add ETA and Severity
        const { dist, eta, severity } = calculateMetrics(data.lat, data.lng);
        const enriched = { ...data, timestamp, dist, eta, severity };

        setIncident(enriched);
        
        setLogs(prev => {
          const updatedLogs = [enriched, ...prev].slice(0, 15);
          localStorage.setItem('sentinel_logs', JSON.stringify(updatedLogs));
          return updatedLogs;
        });

        if (window.L && leafletMap.current) {
          markerLayer.current.clearLayers();
          const markerColor = severity === 'CRITICAL' ? '#ff4b5c' : '#ffa500';
          window.L.marker([data.lat, data.lng], {
            icon: window.L.divIcon({ 
              html: `<div class="ping" style="filter: drop-shadow(0 0 10px ${markerColor})">🚨</div>`, 
              className: 'm-icon' 
            })
          }).addTo(markerLayer.current);
          leafletMap.current.flyTo([data.lat, data.lng], 14);
        }

        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(
          `Attention! ${severity} ${data.type} alert at ${data.address}. Distance ${dist} kilometers. E.T.A ${eta} minutes.`
        );
        window.speechSynthesis.speak(speech);
      }
    });

    return () => { clearInterval(timer); socket.current.disconnect(); };
  }, [isSystemOn]);

  // Scanner Logic
  useEffect(() => {
    let interval;
    if (isSystemOn) {
      interval = setInterval(() => {
        socket.current.emit('send_emergency', {
          id: `ID-${Date.now()}`,
          type: ['POLICE', 'MEDICAL', 'FIRE'][Math.floor(Math.random() * 3)],
          lat: 23.14 + (Math.random() * 0.09),
          lng: 79.89 + (Math.random() * 0.13),
          address: ['Civic Center Sector 4', 'Vijay Nagar Square', 'Sadar Cantt Area', 'Adhartal Industrial Area'][Math.floor(Math.random() * 4)]
        });
      }, 9000);
    }
    return () => clearInterval(interval);
  }, [isSystemOn]);

  return (
    <div style={ui.app}>
      <header style={ui.header}>
        <div style={ui.brand}>SENTINEL <span style={{color:'#00d2ff'}}>v18_ULTRA_PRO</span></div>
        <div style={ui.metrics}>
          <div>TIME: {currentTime}</div>
          <div>UPLINK: <span style={{color:'#00ff88'}}>{uplinkSpeed} Mbps</span></div>
        </div>
        <div style={ui.radarBtn} onClick={() => setIsSystemOn(!isSystemOn)}>
          <div style={{...ui.disk, borderColor: isSystemOn ? '#00ff88' : '#ff4b5c'}}>
            <div style={{...ui.sweep, animation: isSystemOn ? 'rot 2s linear infinite' : 'none'}}></div>
          </div>
          <span style={{fontWeight:'bold'}}>{isSystemOn ? 'SCANNING...' : 'SYSTEM_IDLE'}</span>
        </div>
      </header>

      <div style={ui.main}>
        <aside style={ui.sidebar}>
          {/* ACTIVE INTEL CARD WITH ETA */}
          <div style={ui.card}>
            <p style={ui.tag}>LIVE_INTEL_ANALYSIS</p>
            {incident ? (
              <div style={{borderLeft: `4px solid ${incident.severity === 'CRITICAL' ? '#ff4b5c' : '#ffa500'}`, paddingLeft: '15px'}}>
                <h2 style={{color:'#ff4b5c', margin:0}}>{incident.type}</h2>
                <p style={{margin:'5px 0', fontSize:'15px'}}>{incident.address}</p>
                <div style={ui.etaGrid}>
                  <div><small>DISTANCE</small><br/><b>{incident.dist} KM</b></div>
                  <div><small>E.T.A</small><br/><b style={{color:'#00ff88'}}>{incident.eta} MIN</b></div>
                  <div><small>PRIORITY</small><br/><b style={{color: incident.severity === 'CRITICAL' ? '#ff4b5c' : '#00d2ff'}}>{incident.severity}</b></div>
                </div>
              </div>
            ) : "AWAITING SATELLITE LINK..."}
          </div>

          {/* NEW FEATURE: RESOURCE STATUS */}
          <div style={ui.card}>
            <p style={ui.tag}>RESOURCE_DEPLOYMENT</p>
            <div style={{fontSize:'12px', display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
              <span>ACTIVE UNITS</span> <span>84%</span>
            </div>
            <div style={ui.progressContainer}>
              <div style={{...ui.progressFill, width: isSystemOn ? '84%' : '0%'}}></div>
            </div>
          </div>

          <div style={ui.logBox}>
            <p style={ui.tag}>SITREP_LOGS (PERSISTENT)</p>
            <div style={ui.scroll}>
              {logs.map((l, i) => (
                <div key={i} style={{...ui.logLine, borderLeft: `2px solid ${l.severity === 'CRITICAL' ? '#ff4b5c' : '#00d2ff'}`}}>
                  <span style={{color:'#00d2ff', fontSize:'9px'}}>[{l.timestamp}]</span> {l.type} - {l.address}
                </div>
              ))}
            </div>
            <button onClick={() => {localStorage.removeItem('sentinel_logs'); setLogs([]);}} style={ui.clearBtn}>PURGE SYSTEM LOGS</button>
          </div>
        </aside>
        <div ref={mapRef} style={ui.map}>
            <div style={ui.mapLabel}>HQ_JABALPUR_SECTOR</div>
        </div>
      </div>
      <style>{`
        @keyframes rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ping { font-size: 30px; animation: pulse 1s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
};

const ui = {
  app: { height: '100vh', background: '#05070a', color: '#fff', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '10px 40px', background: '#0d1117', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: '22px', fontWeight: 'bold', letterSpacing: '1px' },
  metrics: { display: 'flex', gap: '30px', fontSize: '12px', color: '#8b949e' },
  radarBtn: { display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: '#161b22', padding: '8px 15px', borderRadius: '4px', border: '1px solid #333' },
  disk: { width: '30px', height: '30px', border: '2px solid', borderRadius: '50%', position: 'relative', overflow: 'hidden' },
  sweep: { position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', background: 'conic-gradient(from 0deg, transparent, #00ff88)', transformOrigin: 'top left' },
  main: { flex: 1, display: 'flex', padding: '20px', gap: '20px', overflow: 'hidden' },
  sidebar: { width: '360px', display: 'flex', flexDirection: 'column', gap: '15px' },
  card: { background: '#0d1117', padding: '20px', borderRadius: '12px', border: '1px solid #333' },
  tag: { fontSize: '10px', color: '#00d2ff', fontWeight: 'bold', marginBottom: '10px' },
  etaGrid: { display: 'flex', justifyContent: 'space-between', marginTop: '15px', textAlign: 'center', borderTop: '1px solid #222', paddingTop: '10px' },
  logBox: { flex: 1, background: '#0d1117', padding: '15px', borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  scroll: { flex: 1, overflowY: 'auto' },
  logLine: { fontSize: '11px', padding: '8px', marginBottom: '5px', background: '#161b22', borderRadius: '4px' },
  clearBtn: { marginTop: '10px', background: 'transparent', color: '#ff4b5c', border: '1px solid #ff4b5c', padding: '5px', cursor: 'pointer', fontSize: '10px' },
  map: { flex: 1, borderRadius: '15px', border: '1px solid #333', background: '#0d1117', position: 'relative' },
  mapLabel: { position: 'absolute', bottom: '15px', left: '15px', color: '#00d2ff', fontSize: '10px', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', zIndex: 1000 },
  progressContainer: { height: '6px', background: '#222', borderRadius: '10px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#00ff88', boxShadow: '0 0 10px #00ff88', transition: 'width 2s ease-in-out' }
};

export default App;