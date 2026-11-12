import React, { useEffect, useRef, useState } from 'react';
import {
  Bluetooth,
  BluetoothOff,
  Wifi,
  RefreshCw,
  Heart,
  Volume2,
  Leaf,
  Droplets,
  Thermometer,
  Sun,
  ChevronRight,
  Settings2,
  Sparkles,
} from 'lucide-react';

/* ==========================================================================
   Configuration
   ========================================================================== */

// BLE UUIDs: must match the ESP32 firmware
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// Backend URL, configurable via Vite env vars (.env)
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const PATH = import.meta.env.VITE_READINGS_PATH || '/readings';
const API_URL = `${BASE}${PATH.startsWith('/') ? '' : '/'}${PATH}`;

// Sample readings that loop in demo mode
const DEMO = [
  { temperature: 24.1, humidity: 60, heatIndexF: 76.1, soilMoisture: 62 },
  { temperature: 24.3, humidity: 61, heatIndexF: 76.5, soilMoisture: 61 },
  { temperature: 24.4, humidity: 62, heatIndexF: 76.8, soilMoisture: 60 },
  { temperature: 24.6, humidity: 61, heatIndexF: 77.2, soilMoisture: 59 },
  { temperature: 24.5, humidity: 63, heatIndexF: 77.1, soilMoisture: 58 },
  { temperature: 24.7, humidity: 62, heatIndexF: 77.6, soilMoisture: 57 },
  { temperature: 24.9, humidity: 62, heatIndexF: 78.0, soilMoisture: 56 },
  { temperature: 24.8, humidity: 61, heatIndexF: 77.8, soilMoisture: 55 },
];

/* ==========================================================================
   Helpers
   ========================================================================== */

// Format a number to d decimals, or '--' if it isn't a finite number
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '--');

// Convert a backend JSON response into our reading shape.
// Accepts an array (uses the last item), { latest }, { reading }, or a bare object,
// and tolerates several different field names for each sensor value.
function normalize(payload) {
  const d = Array.isArray(payload)
    ? payload.at(-1)
    : (payload?.latest ?? payload?.reading ?? payload);

  if (!d || typeof d !== 'object') throw new Error('Invalid API response');

  // Return the first key that holds a valid number, otherwise null
  const get = (...keys) => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
        const n = Number(d[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  };

  const c = get('temperature_c', 'tempC', 'temperature', 'temp');
  const f = get('temperature_f', 'tempF');

  const data = {
    // Prefer Celsius; fall back to converting Fahrenheit
    temperature: c ?? (f === null ? null : ((f - 32) * 5) / 9),
    humidity: get('humidity', 'humidity_percent', 'relative_humidity'),
    heatIndexF: get('heat_index_f', 'heatIndexF', 'heat_index', 'feels_like_f'),
    soilMoisture: get('soil_moisture', 'soilMoisture', 'soil_percent', 'soilPercent', 'soil'),
  };

  if (Object.values(data).every((x) => x === null)) {
    throw new Error('No recognized sensor fields');
  }
  return data;
}

// Parse the BLE payload: "temp,humidity,heatIndexF,soil" as comma-separated text
function parseBle(value) {
  const str = new TextDecoder().decode(value);
  const v = str.trim().split(',').map(Number);

  if (v.length !== 4 || !v.every(Number.isFinite)) {
    throw new Error('Invalid Bluetooth payload: ' + str);
  }
  return {
    temperature: v[0],
    humidity: v[1],
    heatIndexF: v[2],
    soilMoisture: v[3],
  };
}

/* ==========================================================================
   Components
   ========================================================================== */

// Pixel-art SVG plant. Used in the top-bar logo; the main stage uses PNGs instead.
function Sprout({ mood = 'happy', size = 'large' }) {
  const sad = mood === 'thirsty';

  return (
    <svg
      className={`sprout-art sprout-${size}`}
      viewBox="0 0 220 220"
      role="img"
      aria-label={
        sad ? 'A thirsty little plant in a flower pot' : 'A smiling pixel-art plant in a flower pot'
      }
      shapeRendering="crispEdges"
    >
      {/* Stem and leaves */}
      <g fill="#507849" stroke="#283d37" strokeWidth="5" strokeLinejoin="miter">
        <path d="M105 108 L101 59 L111 59 L116 108 Z" />
        <path d="M107 75 C79 79 58 66 55 37 C82 38 103 48 107 75Z" fill="#78a66b" />
        <path d="M109 69 C112 42 135 26 162 29 C160 54 139 73 109 69Z" fill="#9ac27c" />
        <path d="M104 96 C88 96 72 85 73 71 C92 70 105 78 104 96Z" fill="#a7cb88" />
      </g>

      {/* Leaf highlights */}
      <path d="M102 58 L82 53 M117 54 L139 43" stroke="#e2efb1" strokeWidth="5" fill="none" />

      {/* Pot body, shading and rim */}
      <path
        d="M55 107H166V126H156L146 186H76L65 126H55Z"
        fill="#bf815d"
        stroke="#563e39"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M63 130H156L152 140H67Z" fill="#e5a477" />
      <path d="M77 157H144L139 180H83Z" fill="#cd906d" />
      <path d="M53 105H168V127H53Z" fill="#e0a37e" stroke="#563e39" strokeWidth="6" />
      <path d="M65 113H151" stroke="#f3c59a" strokeWidth="5" />

      {/* Face: sad when thirsty, smiling otherwise */}
      {sad ? (
        <>
          <path d="M86 156l8-4 M125 152l8 4" stroke="#45362f" strokeWidth="5" />
          <path d="M101 170 Q111 160 121 170" fill="none" stroke="#45362f" strokeWidth="4" />
        </>
      ) : (
        <>
          <rect x="87" y="150" width="7" height="9" rx="2" fill="#362b2a" />
          <rect x="127" y="150" width="7" height="9" rx="2" fill="#362b2a" />
          <path
            d="M101 161 Q110 174 121 161"
            fill="none"
            stroke="#362b2a"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Blush */}
      <rect x="76" y="162" width="12" height="6" fill="#f4b2a1" opacity=".95" />
      <rect x="133" y="162" width="12" height="6" fill="#f4b2a1" opacity=".95" />

      {/* Sparkles */}
      <path
        d="M42 74h5v-6h5v6h5v5h-5v6h-5v-6h-5z M175 83h4v-5h4v5h5v4h-5v5h-4v-5h-4z"
        fill="#f6df90"
      />

      {/* Grass tufts */}
      <path d="M34 178h14v-6h8v6h11 M151 178h21v-6h12" fill="none" stroke="#769863" strokeWidth="5" />
    </svg>
  );
}

// Line chart of recent values (temperature history)
function Trend({ values }) {
  const vals = values.filter((v) => Number.isFinite(v));

  if (vals.length < 2) {
    return <div className="empty-chart">Waiting for readings...</div>;
  }

  // Pad the y-range slightly so the line doesn't touch the edges
  const min = Math.min(...vals) - 0.45;
  const max = Math.max(...vals) + 0.45;

  // Map each value to an [x, y] point inside the 640x150 viewBox
  const p = vals.map((v, i) => [
    12 + (i * 616) / (vals.length - 1),
    124 - ((v - min) / (max - min)) * 98,
  ]);

  // Build the SVG path string
  const line = p
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  return (
    <svg
      className="chart"
      viewBox="0 0 640 150"
      preserveAspectRatio="none"
      role="img"
      aria-label="Recent temperature trend"
    >
      {/* Gradient used for the area fill under the line */}
      <defs>
        <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#8eae75" stopOpacity=".35" />
          <stop offset="1" stopColor="#8eae75" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Dashed horizontal grid lines */}
      {[25, 58, 91, 124].map((y) => (
        <line key={y} x1="0" x2="640" y1={y} y2={y} stroke="#dcd8c4" strokeDasharray="4 7" />
      ))}

      {/* Filled area under the line */}
      <path d={`${line} L628,140 L12,140 Z`} fill="url(#fade)" />

      {/* The line itself */}
      <path
        d={line}
        fill="none"
        stroke="#50734e"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* A dot at each data point */}
      {p.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#50734e" stroke="#fff7de" strokeWidth="1.8" />
      ))}
    </svg>
  );
}

// One sensor card (icon, title, big number + unit, description)
function Metric({ title, value, unit, sub, icon: Icon, kind }) {
  return (
    <div className="metric-card">
      <div className="metric-heading">
        <div className={`metric-icon ${kind}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <span>{title}</span>
      </div>
      <div className="metric-reading">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-desc">{sub}</div>
    </div>
  );
}


function BackgroundMusic() {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // Original cozy garden melody
  const melody = [
    523.25, 659.25, 783.99, 659.25,
    587.33, 698.46, 880, 783.99,
    659.25, 523.25, 587.33, 659.25,
    440, 523.25, 587.33, 0,
  ];

  const playNote = (frequency, time, ctx) => {
    if (!frequency) return;

    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    volume.gain.setValueAtTime(0.0001, time);
    volume.gain.exponentialRampToValueAtTime(0.045, time + 0.03);
    volume.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

    oscillator.connect(volume);
    volume.connect(ctx.destination);

    oscillator.start(time);
    oscillator.stop(time + 0.34);
  };

  const stopMusic = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;

    if (audioRef.current) {
      audioRef.current.close();
      audioRef.current = null;
    }

    setPlaying(false);
  };

  const toggleMusic = async () => {
    if (audioRef.current) {
      stopMusic();
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      const ctx = new AudioContextClass();
      audioRef.current = ctx;
      await ctx.resume();

      let index = 0;

      const nextNote = () => {
        playNote(melody[index], ctx.currentTime, ctx);
        index = (index + 1) % melody.length;
      };

      nextNote();
      timerRef.current = setInterval(nextNote, 350);
      setPlaying(true);
    } catch (error) {
      console.error("Unable to start music:", error);
      stopMusic();
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.close();
    };
  }, []);

  return (
    <button
      type="button"
      className="music-toggle"
      onClick={toggleMusic}
      aria-pressed={playing}
    >
      {playing ? "♫ MUSIC ON" : "♪ MUSIC OFF"}
    </button>
  );
}


/* ==========================================================================
   App
   ========================================================================== */

export default function App() {
  /* ---------- State ---------- */
  const [mode, setMode] = useState('demo'); // 'demo' | 'ble' | 'api'
  const [reading, setReading] = useState(DEMO.at(-1)); // latest sensor reading
  const [history, setHistory] = useState(DEMO.map((x) => x.temperature)); // chart data
  const [status, setStatus] = useState('demo'); // 'demo' | 'connecting' | 'online' | 'offline'
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null); // timestamp of last reading
  const [refresh, setRefresh] = useState(0); // bump to re-trigger the API effect
  const [demoIdx, setDemoIdx] = useState(7); // current position in DEMO

  /* ---------- Bluetooth refs (persist across renders without re-rendering) ---------- */
  const device = useRef(null);
  const characteristic = useRef(null);
  const handler = useRef(null); // characteristicvaluechanged listener
  const disHandler = useRef(null); // gattserverdisconnected listener

  /* ---------- Actions ---------- */

  // Store a new reading, append to history (keep last 24), and mark as online
  function accept(next) {
    setReading(next);
    setHistory((h) =>
      Number.isFinite(next.temperature) ? [...h, next.temperature].slice(-24) : h
    );
    setUpdated(new Date());
    setStatus('online');
    setError('');
  }

  // Remove BLE listeners, drop the GATT connection, and clear refs
  function disconnect() {
    if (characteristic.current && handler.current) {
      characteristic.current.removeEventListener('characteristicvaluechanged', handler.current);
    }
    if (device.current && disHandler.current) {
      device.current.removeEventListener('gattserverdisconnected', disHandler.current);
    }
    if (device.current?.gatt?.connected) {
      device.current.gatt.disconnect();
    }
    device.current = null;
    characteristic.current = null;
    handler.current = null;
    disHandler.current = null;
  }

  // Connect to the ESP32 over Web Bluetooth and subscribe to notifications
  async function connect() {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth requires Chrome or Edge on localhost/HTTPS.');
      return;
    }

    try {
      disconnect();
      setStatus('connecting');
      setError('');

      // Ask the user to pick the device
      const d = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'ESP32-Weather' }],
        optionalServices: [SERVICE_UUID],
      });
      device.current = d;

      // Handle unexpected disconnects
      disHandler.current = () => {
        setStatus('offline');
        setError('Bluetooth disconnected. Reconnect to continue.');
      };
      d.addEventListener('gattserverdisconnected', disHandler.current);

      // Walk down GATT: server -> service -> characteristic
      const server = await d.gatt.connect();
      const svc = await server.getPrimaryService(SERVICE_UUID);
      const ch = await svc.getCharacteristic(CHARACTERISTIC_UUID);
      characteristic.current = ch;

      // Parse each incoming notification
      handler.current = (e) => {
        try {
          accept(parseBle(e.target.value));
        } catch (err) {
          setError(err.message);
        }
      };
      ch.addEventListener('characteristicvaluechanged', handler.current);
      await ch.startNotifications();

      // Connected, but no data has arrived yet
      setStatus('connecting');
      setError('Bluetooth connected. Waiting for the next sensor update…');
    } catch (err) {
      disconnect();
      setStatus('offline');
      setError(
        err.name === 'NotFoundError'
          ? 'No device selected. Ensure ESP32-Weather is powered on.'
          : err.message
      );
    }
  }

  // Switch data source and reset all reading state
  function switchMode(next) {
    disconnect();
    setMode(next);
    setReading(next === 'demo' ? DEMO.at(-1) : null);
    setHistory(next === 'demo' ? DEMO.map((d) => d.temperature) : []);
    setStatus(next === 'demo' ? 'demo' : 'offline');
    setError('');
    setUpdated(null);
  }

  /* ---------- Effects ---------- */

  // Demo mode: cycle through the sample readings every 3 seconds
  useEffect(() => {
    if (mode !== 'demo') return;

    const id = setInterval(() => {
      setDemoIdx((i) => {
        const j = (i + 1) % DEMO.length;
        accept(DEMO[j]);
        return j;
      });
    }, 3000);

    return () => clearInterval(id);
  }, [mode]);

  // API mode: poll the FastAPI backend every 3 seconds
  useEffect(() => {
    if (mode !== 'api') return;

    let active = true; // guards against updating state after cleanup
    let controller = null;

    const pull = async () => {
      controller?.abort(); // cancel any in-flight request
      controller = new AbortController();

      try {
        const r = await fetch(API_URL, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!r.ok) throw new Error(`Backend returned HTTP ${r.status}`);

        const next = normalize(await r.json());
        if (active) accept(next);
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          setStatus('offline');
          setError(err.message);
        }
      }
    };

    setStatus('connecting');
    pull();
    const id = setInterval(pull, 3000);

    return () => {
      active = false;
      controller?.abort();
      clearInterval(id);
    };
  }, [mode, refresh]);

  // Disconnect Bluetooth when the component unmounts
  useEffect(() => () => disconnect(), []);

  /* ---------- Derived values ---------- */
  const soil = reading?.soilMoisture;
  const thirsty = Number.isFinite(soil) && soil < 30; // below 30% soil moisture
  const mood = thirsty ? 'thirsty' : 'happy';
  const disconnected = mode !== 'demo' && status !== 'online';
  const name = thirsty ? 'Thirsty buddy' : 'Happy little sprout';
  const summary = thirsty ? 'Your companion needs a drink!' : 'Your companion is growing happily!';

  /* ---------- Render ---------- */
  return (
    <div className="app">
      {/* Background texture */}
      <div className="grain" aria-hidden="true" />

      {/* ===== Top bar ===== */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol">
            <img
              src="/Hydrosense Logo.png"
              alt="HydroSense logo"
              className="brand-logo-img"
            />
          </div>
          <div>
            <div className="brand-name">
              HYDROSENSE<span>★</span>
            </div>
            <p>Rooted in Data.</p>
          </div>
        </div>

        <div className="top-right">
          <BackgroundMusic />
          <span className="mini-tag">✦ FIELD GUIDE No. 001</span>
          <span className="top-avatar">
            <Leaf size={18} />
          </span>
        </div>
      </header>

      <main className="container">
        {/* ===== Welcome + data source selector ===== */}
        <section className="welcome">
          <div>
            <div className="section-kicker">✦ YOUR PLANT'S STATS, ONE GLANCE AT A TIME ✦</div>
            <h1>
              A little greener, <em>one drop at a time.</em>
            </h1>
            <p>Real-time insights into temperature, humidity, and soil moisture.</p>
          </div>

          <div className="mode-panel">
            <label htmlFor="source">DATA SOURCE</label>
            <select id="source" value={mode} onChange={(e) => switchMode(e.target.value)}>
              <option value="demo">✧ Demo adventure</option>
              <option value="ble">Bluetooth · ESP32</option>
              <option value="api">FastAPI · Backend</option>
            </select>
            <div className={`live-status ${status}`}>
              ●{' '}
              {mode === 'demo'
                ? 'SIMULATED DATA'
                : status === 'online'
                  ? 'LIVE CONNECTION'
                  : status === 'connecting'
                    ? 'CONNECTING...'
                    : 'NOT CONNECTED'}
            </div>
          </div>
        </section>

        {/* ===== Mode notice (+ connect / retry button) ===== */}
        <div className="notice">
          <Sparkles size={17} />
          <span>
            {mode === 'demo'
              ? 'You’re in demo mode! All readings here are sample values — not real sensor measurements.'
              : mode === 'ble'
                ? 'Bluetooth mode: use Chrome or Edge on macOS or Windows, then connect to ESP32-Weather.'
                : 'Backend mode: polling your FastAPI endpoint every 3 seconds.'}
          </span>

          {mode === 'ble' && (
            <button
              className="notice-btn"
              onClick={
                status === 'online'
                  ? () => {
                      disconnect();
                      setStatus('offline');
                      setError('');
                    }
                  : connect
              }
            >
              {status === 'online' ? 'Disconnect' : 'Connect BLE'} <ChevronRight size={13} />
            </button>
          )}

          {mode === 'api' && (
            <button className="notice-btn" onClick={() => setRefresh((i) => i + 1)}>
              Retry <RefreshCw size={13} />
            </button>
          )}
        </div>

        {/* ===== Error banner ===== */}
        {error && (
          <div className="error-msg" role="alert">
            ✦ {error}
          </div>
        )}

        <div className="dashboard">
          {/* ===== Left column: companion card ===== */}
          <section className="companion-card">
            <div className="card-top">
              <div className="companion-id">
                No. 001 <span>✧ GRASS TYPE</span>
              </div>
              <div className="heart-row">
                <Heart fill="#ef9695" size={18} />
                <Heart fill="#ef9695" size={18} />
                <Heart fill="#ef9695" size={18} />
              </div>
            </div>

            {/* Scene: sun, stars, clouds, plant image, grass */}
            <div className="stage">
              <div className="stage-sun">✧</div>
              <div className="stage-star star-a">✦</div>
              <div className="stage-star star-b">✳</div>
              <div className="stage-cloud cloud-a"></div>
              <div className="stage-cloud cloud-b"></div>

              {/* Image swaps based on soil moisture (files live in /public) */}
              <img
                src={thirsty ? '/sprout-thirsty.png' : '/sprout-happy.png'}
                alt="My Sprout companion"
                className="sprout-character"
              />

              <div className="stage-grass">⌁ ⌁ ⌁ ⌁ ⌁ ⌁ ⌁</div>
            </div>

            <div className="companion-body">
              <div className="friend-line">
                <span className="friend-name">{name}</span>
                <span className="level">LV. 01</span>
              </div>

              {/* Soil moisture shown as an HP bar */}
              <div className="health-line">
                <span>SOIL HP</span>
                <div className="hp-track">
                  <div style={{ width: `${Math.min(100, Math.max(0, soil ?? 0))}%` }} />
                </div>
                <strong>{soil === null || soil === undefined ? '--' : fmt(soil)}%</strong>
              </div>

              {/* Dialogue box */}
              <div className="message-box">
                <span className="message-star">✦</span>
                <p>{disconnected ? 'Waiting to hear from your plant…' : summary}</p>
                <span className="cursor">▼</span>
              </div>
            </div>
          </section>

          {/* ===== Right column: readings ===== */}
          <section className="readings">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">YOUR ADVENTURE LOG</div>
                <h2>
                  Current conditions <span>✿</span>
                </h2>
              </div>
              <span className="update-label">
                {mode === 'demo'
                  ? 'DEMO • UPDATES EVERY 3S'
                  : updated
                    ? `UPDATED ${updated.toLocaleTimeString()}`
                    : 'AWAITING READING'}
              </span>
            </div>

            {/* Four sensor cards */}
            <div className="metrics">
              <Metric
                kind="temperature"
                icon={Thermometer}
                title="TEMPERATURE"
                value={fmt(reading?.temperature, 1)}
                unit="°C"
                sub="Air temperature"
              />
              <Metric
                kind="humidity"
                icon={Droplets}
                title="HUMIDITY"
                value={fmt(reading?.humidity)}
                unit="%"
                sub="Relative humidity"
              />
              <Metric
                kind="feels"
                icon={Sun}
                title="FEELS LIKE"
                value={fmt(reading?.heatIndexF, 1)}
                unit="°F"
                sub="Calculated heat index"
              />
              <Metric
                kind="soil"
                icon={Leaf}
                title="SOIL MOISTURE"
                value={fmt(reading?.soilMoisture)}
                unit="%"
                sub="Moisture in soil"
              />
            </div>

            {/* Temperature history chart */}
            <div className="chart-panel">
              <div className="chart-top">
                <div>
                  <div className="tiny-kicker">✦ FIELD OBSERVATIONS</div>
                  <h3>Temperature journey</h3>
                </div>
                <span className="chart-chip">
                  <span className="chart-dot" /> RECENT READINGS
                </span>
              </div>

              <Trend values={history} />

              <div className="chart-bottom">
                <span>EARLIER</span>
                <span>NOW →</span>
              </div>
            </div>
          </section>
        </div>

        {/* ===== Footer ===== */}
        <footer>
          MADE WITH ♡ FOR LITTLE GREEN THINGS <span>·</span> ESP32 + DHT11 + SOIL SENSOR{' '}
          <span>·</span> <strong>HYDROSENSE</strong>
        </footer>
      </main>
    </div>
  );
}