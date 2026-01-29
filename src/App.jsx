import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { supabase } from './supabase';

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e);
    },
  });
  return null;
}

function App() {
  const [markers, setMarkers] = useState([]);
  const [filteredMarkers, setFilteredMarkers] = useState([]);

  // click + form state
  const [clickedPos, setClickedPos] = useState(null);
  const [country, setCountry] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  // search and filter state
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [countries, setCountries] = useState([]);

  // fetch existing markers + realtime
  useEffect(() => {
    const fetchMarkers = async () => {
      const { data, error } = await supabase
        .from('markers')
        .select('*');

      if (!error) setMarkers(data);
    };

    fetchMarkers();

    const channel = supabase
      .channel('markers-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'markers' },
        (payload) => {
          setMarkers((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // extract countries and filter markers
  useEffect(() => {
    // Extract unique countries
    const uniqueCountries = [...new Set(markers.map(m => m.country).filter(Boolean))];
    setCountries(uniqueCountries);

    // Filter markers based on country
    let filtered = markers;
    
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(m => m.country === selectedCountry);
    }
    
    setFilteredMarkers(filtered);
  }, [markers, selectedCountry]);

  // handle map click
  const handleMapClick = async (e) => {
    if (sessionStorage.getItem('hasPlacedMark')) {
      alert('You already placed a mark in this session');
      return;
    }

    const { lat, lng } = e.latlng;
    setClickedPos({ lat, lng });

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      setCountry(data?.address?.country || 'Unknown');
    } catch {
      setCountry('Unknown');
    }
  };

  // submit marker
  const handleSubmit = async () => {
    if (!name || !message) {
      alert('Name and message required');
      return;
    }

    const { error } = await supabase.from('markers').insert({
      lat: clickedPos.lat,
      lng: clickedPos.lng,
      name,
      message,
      country,
    });

    if (error) {
      console.error(error);
      alert('Insert failed');
      return;
    }

    sessionStorage.setItem('hasPlacedMark', 'true');
    setClickedPos(null);
    setName('');
    setMessage('');
  };

  return (
    <>
      {/* Header with stats and controls */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '15px 20px',
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ color: 'white' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>🗺️ World Map</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Total Marks: <strong>{markers.length}</strong> | Showing: <strong>{filteredMarkers.length}</strong>
            </p>
          </div>
          
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '20px',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="all">🌍 All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>
                {country} ({markers.filter(m => m.country === country).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      <MapContainer
        center={[20, 0]}
        zoom={3}
        minZoom={2}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ width: '100vw', height: 'calc(100vh - 100px)', marginTop: '100px' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
          attribution="© OpenStreetMap contributors"
        />

        <MapClickHandler onClick={handleMapClick} />

        {filteredMarkers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong style={{ fontSize: '16px', color: '#667eea' }}>{m.name}</strong><br />
                <span style={{ fontSize: '14px', color: '#666' }}>{m.message}</span><br />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  📍 {m.country}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* MODAL */}
      {clickedPos && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '24px',
            zIndex: 1001,
            width: '350px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '20px' }}>📍 Place Your Mark</h3>

          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ 
              width: '100%', 
              marginBottom: '12px',
              padding: '10px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />

          <textarea
            placeholder="Message (max 100 chars)"
            maxLength={100}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ 
              width: '100%', 
              marginBottom: '12px',
              padding: '10px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />

          <input
            value={country}
            disabled
            style={{ 
              width: '100%', 
              marginBottom: '16px',
              padding: '10px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px',
              background: '#f8f9fa'
            }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleSubmit} 
              style={{ 
                flex: 1,
                padding: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Place Marker
            </button>
            <button 
              onClick={() => setClickedPos(null)}
              style={{
                padding: '12px 20px',
                background: '#e1e5e9',
                color: '#666',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
