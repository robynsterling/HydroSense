import React, { useEffect, useRef, useState } from 'react';
import { Leaf, X } from 'lucide-react';

const THEME_KEY = 'hydrosense-theme';
const isTheme = (value) => value === 'light' || value === 'dark';

export default function Settings({ temperatureUnit, onTemperatureUnitChange }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#232b22' : '#e7dfc5';
  }, [theme]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    let explicit = false;
    try { explicit = isTheme(localStorage.getItem(THEME_KEY)); } catch {}
    const followSystem = () => {
      if (!explicit) setTheme(preference.matches ? 'dark' : 'light');
    };
    const onStorage = (event) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      explicit = isTheme(event.newValue);
      setTheme(explicit ? event.newValue : preference.matches ? 'dark' : 'light');
    };
    // A selection remains explicit for this session even if storage is unavailable.
    const onSelection = (event) => { if (event.target.name === 'theme') explicit = true; };
    preference.addEventListener('change', followSystem);
    window.addEventListener('storage', onStorage);
    const panel = dialog.current;
    panel.addEventListener('change', onSelection);
    return () => {
      preference.removeEventListener('change', followSystem);
      window.removeEventListener('storage', onStorage);
      panel.removeEventListener('change', onSelection);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  function selectTheme(next) {
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }

  return (
    <>
      <button ref={trigger} type="button" className="top-avatar" aria-label="Settings"
        aria-haspopup="dialog" aria-expanded={open} aria-controls="settings-panel"
        data-tooltip-hidden={tooltipDismissed || open}
        onPointerEnter={() => setTooltipDismissed(false)}
        onFocus={() => setTooltipDismissed(false)}
        onKeyDown={(event) => { if (event.key === 'Escape') setTooltipDismissed(true); }}
        onClick={() => { dialog.current.showModal(); setOpen(true); }}>
        <Leaf size={18} aria-hidden="true" />
        <span className="settings-tooltip" aria-hidden="true">Settings</span>
      </button>
      <dialog ref={dialog} id="settings-panel" className="settings-panel"
        aria-labelledby="settings-title" aria-describedby="settings-description"
        onClose={() => { setOpen(false); trigger.current.focus(); }}>
        <div className="settings-heading">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="settings-close" aria-label="Close settings"
            autoFocus onClick={() => dialog.current.close()}><X size={20} aria-hidden="true" /></button>
        </div>
        <p id="settings-description">Make your little greenhouse feel like home.</p>
        <fieldset className="theme-options">
          <legend>Appearance</legend>
          {['light', 'dark'].map((value) => (
            <label key={value}>
              <input type="radio" name="theme" value={value} checked={theme === value}
                onChange={() => selectTheme(value)} />
              {value === 'light' ? 'Light mode' : 'Dark mode'}
            </label>
          ))}
        </fieldset>
        <fieldset className="theme-options">
          <legend>Temperature unit</legend>
          {['C', 'F'].map((value) => (
            <label key={value}>
              <input type="radio" name="temperature-unit" value={value}
                checked={temperatureUnit === value}
                onChange={() => onTemperatureUnitChange(value)} />
              {value === 'C' ? '°C Celsius' : '°F Fahrenheit'}
            </label>
          ))}
        </fieldset>
        <p className="settings-note">Your choices are saved on this browser when storage is available.</p>
      </dialog>
    </>
  );
}
