import { TESTS } from './presets.js';

export function bindUI(handlers) {
  const tests = document.getElementById('tests');
  tests.className = 'cards';
  for (const t of TESTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.id = t.id;
    b.innerHTML = `<strong>${t.name}</strong><span>${t.when} · ${t.where}</span>`;
    b.addEventListener('click', () => handlers.onTest(t.id));
    tests.appendChild(b);
  }

  const cameras = document.getElementById('cameras');
  cameras.className = 'cards';

  const bindRange = (id, outId, format, on) => {
    const el = document.getElementById(id);
    const out = document.getElementById(outId);
    const pull = () => {
      out.textContent = format(Number(el.value));
      on(Number(el.value));
    };
    el.addEventListener('input', pull);
    pull();
    return el;
  };

  bindRange('distance', 'dist-out', (v) => `${v.toFixed(2)}×`, handlers.onDistance);
  bindRange('focal', 'focal-out', (v) => `${v.toFixed(0)} mm`, handlers.onFocal);
  bindRange('focus', 'focus-out', (v) => `${(v / 1000).toFixed(2)} km`, handlers.onFocus);
  bindRange('fstop', 'fstop-out', (v) => `ƒ/${v.toFixed(1)}`, handlers.onFStop);
  bindRange('time', 'time-out', (v) => `${v.toFixed(1)} s`, handlers.onTime);
  bindRange('roll', 'roll-out', (v) => `${v.toFixed(0)} s`, handlers.onRoll);
  bindRange('rate', 'rate-out', (v) => `${v.toFixed(1)}×`, handlers.onRate);
  bindRange('mass', 'mass-out', (v) => v.toFixed(1), handlers.onMix);
  bindRange('particles', 'particles-out', (v) => Math.round(v).toLocaleString(), handlers.onMix);
  bindRange('dust', 'dust-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('dust-size', 'dust-size-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('dust-div', 'dust-div-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('shock', 'shock-out', (v) => `${v.toFixed(0)}`, handlers.onMix);
  bindRange('shock-thick', 'shock-thick-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('scale', 'scale-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('plume', 'plume-out', (v) => `${v.toFixed(0)} s`, handlers.onMix);
  bindRange('flash', 'flash-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('stem', 'stem-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('cap', 'cap-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('wind', 'wind-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('grain', 'grain-out', (v) => v.toFixed(2), handlers.onMix);
  bindRange('bright', 'bright-out', (v) => v.toFixed(2), handlers.onBrightness);
  bindRange('gas-bright', 'gas-bright-out', (v) => v.toFixed(2), handlers.onBrightness);
  bindRange('gas-density', 'gas-density-out', (v) => v.toFixed(2), handlers.onGas);
  bindRange('gas-glow', 'gas-glow-out', (v) => v.toFixed(2), handlers.onGas);
  bindRange('gas-sun', 'gas-sun-out', (v) => v.toFixed(2), handlers.onGas);
  bindRange('gas-shadow', 'gas-shadow-out', (v) => v.toFixed(2), handlers.onGas);
  bindRange('gas-anisotropy', 'gas-anisotropy-out', (v) => v.toFixed(2), handlers.onGas);
  bindRange('gas-velocity', 'gas-velocity-out', (v) => `${v.toFixed(0)} m/s`, handlers.onGas);
  bindRange('gas-rise', 'gas-rise-out', (v) => `${v.toFixed(0)} m/s`, handlers.onGas);
  bindRange('gas-duration', 'gas-duration-out', (v) => `${v.toFixed(1)} s`, handlers.onGas);
  bindRange('gas-pressure', 'gas-pressure-out', (v) => v.toFixed(0), handlers.onGas);
  bindRange('gas-buoyancy', 'gas-buoyancy-out', (v) => `${v.toFixed(1)} m/s²`, handlers.onGas);
  bindRange('gas-drag', 'gas-drag-out', (v) => `${v.toFixed(2)} /s`, handlers.onGas);
  bindRange('gas-cooling', 'gas-cooling-out', (v) => `${v.toFixed(3)} /s`, handlers.onGas);
  bindRange('gas-thinning', 'gas-thinning-out', (v) => `${v.toFixed(3)} /s`, handlers.onGas);
  // The smoke mode is only available once its GPU implementation is connected.
  const smokeOption = document.querySelector('#source option[value="smoke"]');
  smokeOption.disabled = typeof handlers.onSmoke !== 'function';
  if (!smokeOption.disabled) {
  bindRange('smoke-velocity', 'smoke-velocity-out', (v) => `${v.toFixed(1)} m/s`, handlers.onSmoke);
  bindRange('smoke-decay', 'smoke-decay-out', (v) => `${v.toFixed(2)} /s`, handlers.onSmoke);
  bindRange('smoke-buoyancy', 'smoke-buoyancy-out', (v) => `${v.toFixed(1)} m/s²`, handlers.onSmoke);
  bindRange('smoke-buoyancy-decay', 'smoke-buoyancy-decay-out', (v) => `${v.toFixed(2)} /s`, handlers.onSmoke);
  bindRange('smoke-turbulence', 'smoke-turbulence-out', (v) => v.toFixed(1), handlers.onSmoke);
  bindRange('smoke-size', 'smoke-size-out', (v) => `${v.toFixed(2)} m`, handlers.onSmoke);
  bindRange('smoke-count', 'smoke-count-out', (v) => v.toLocaleString(), handlers.onSmoke);
  bindRange('smoke-density', 'smoke-density-out', (v) => v.toFixed(2), handlers.onSmoke);
  document.getElementById('smoke-color').addEventListener('input', handlers.onSmoke);
  for (const prefix of ['smoke2']) {
    bindRange(`${prefix}-velocity`, `${prefix}-velocity-out`, (v) => `${v.toFixed(1)} m/s`, handlers.onSmoke);
    bindRange(`${prefix}-decay`, `${prefix}-decay-out`, (v) => `${v.toFixed(2)} /s`, handlers.onSmoke);
    bindRange(`${prefix}-buoyancy`, `${prefix}-buoyancy-out`, (v) => `${v.toFixed(1)} m/s²`, handlers.onSmoke);
    bindRange(`${prefix}-buoyancy-decay`, `${prefix}-buoyancy-decay-out`, (v) => `${v.toFixed(2)} /s`, handlers.onSmoke);
    bindRange(`${prefix}-turbulence`, `${prefix}-turbulence-out`, (v) => v.toFixed(1), handlers.onSmoke);
    bindRange(`${prefix}-size`, `${prefix}-size-out`, (v) => `${v.toFixed(2)} m`, handlers.onSmoke);
    bindRange(`${prefix}-count`, `${prefix}-count-out`, (v) => v.toLocaleString(), handlers.onSmoke);
    bindRange(`${prefix}-density`, `${prefix}-density-out`, (v) => v.toFixed(2), handlers.onSmoke);
    document.getElementById(`${prefix}-color`).addEventListener('input', handlers.onSmoke);
  }
  }
  document.getElementById('gas-smoke-color').addEventListener('input', handlers.onGas);
  document.getElementById('gas-glow-color').addEventListener('input', handlers.onGas);
  document.getElementById('source').addEventListener('change', (e) => handlers.onSource(e.target.value));

  document.getElementById('stock').addEventListener('change', (e) => handlers.onStock(e.target.value));
  document.getElementById('ignite').addEventListener('click', handlers.onIgnite);
  document.getElementById('hold').addEventListener('click', handlers.onHold);
  document.getElementById('reset').addEventListener('click', handlers.onReset);
  document.getElementById('stop').addEventListener('click', handlers.onStop);

  return {
    markTest(id) {
      for (const el of tests.children) el.classList.toggle('on', el.dataset.id === id);
    },
    setCameras(list, active, onPick) {
      cameras.innerHTML = '';
      for (const cam of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cam' + (cam.id === active ? ' on' : '');
        b.innerHTML = `<strong>${cam.name}</strong><span>${cam.detail}</span>`;
        b.addEventListener('click', () => onPick(cam.id));
        cameras.appendChild(b);
      }
    },
    setMix(mix) {
      const map = {
        particles: mix.particles, mass: mix.mass ?? 8, dust: mix.dust, 'dust-size': mix.dustSize, 'dust-div': mix.dustDiv,
        shock: mix.shock, 'shock-thick': mix.shockThick, scale: mix.scale, plume: mix.plume,
        flash: mix.flash, stem: mix.stem, cap: mix.cap, wind: mix.wind, grain: mix.grain
      };
      for (const [id, value] of Object.entries(map)) {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('input'));
      }
    },
    setCaption(text) { document.getElementById('caption').textContent = text; },
    setSourceMode(source) {
      const enabled = source !== 'simulation';
      document.getElementById('gas-controls').hidden = source !== 'gas';
      document.getElementById('smoke-controls').hidden = source !== 'smoke';
      document.getElementById('stop').hidden = source !== 'smoke';
      document.getElementById('hold').disabled = false;
      document.getElementById('simulation-controls').hidden = enabled;
      document.querySelector('#clock-controls h2').textContent = enabled ? 'Flow timeline' : 'Clock';
      document.getElementById('ignite').textContent = source === 'smoke' ? 'Emit smoke' : enabled ? 'Play from start' : 'Ignite';
      document.getElementById('hold').textContent = enabled ? 'Pause / resume' : 'Hold';
      document.getElementById('sound').closest('label').hidden = enabled;
      document.getElementById('count').hidden = true;
    },
    setGasStatus(text) { document.getElementById('gas-status').textContent = text; },
    setSmokeStatus(text) { document.getElementById('smoke-status').textContent = text; },
    setSmokeStopped(stopped) {
      document.getElementById('stop').disabled = stopped;
      document.getElementById('smoke-editor').disabled = stopped;
      document.getElementById('hold').disabled = stopped;
    },
    setLens(focal, focus, fstop) {
      setNum('focal', focal);
      setNum('focus', focus);
      setNum('fstop', fstop);
    },
    showAutoFocus(focus) {
      const el = document.getElementById('focus');
      el.value = focus;
      document.getElementById('focus-out').textContent = `${(focus / 1000).toFixed(2)} km`;
    },
    setTime(t) { setNum('time', t); },
    setRoll(t) { setNum('roll', t); },
    setRollMax(seconds) {
      const el = document.getElementById('time');
      el.max = String(seconds);
    },
    stock: () => document.getElementById('stock').value,
    sound: () => document.getElementById('sound').checked,
    readMix() {
      return {
        particles: num('particles'), mass: num('mass'), dust: num('dust'), dustSize: num('dust-size'), dustDiv: num('dust-div'),
        shock: num('shock'), shockThick: num('shock-thick'), scale: num('scale'), plume: num('plume'),
        flash: num('flash'), stem: num('stem'), cap: num('cap'), wind: num('wind'), grain: num('grain')
      };
    }
  };
}

function num(id) { return Number(document.getElementById(id).value); }
function setNum(id, value) {
  const el = document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new Event('input'));
}
