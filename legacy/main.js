import { loadConfig, saveConfig } from './persistence.js';

// --- HTTP Discovery (Shelly, Tasmota, etc.) ---
async function httpScan() {
  const found = [];
  const subnet = location.hostname.split('.').slice(0,3).join('.');
  const testPorts = [80, 8081];
  let requests = [];
  for (let i=1; i<=254; i++) {
    const ip = `${subnet}.${i}`;
    for (let port of testPorts) {
      requests.push(
        fetch(`http://${ip}:${port}/status`, {mode:'no-cors', cache:'no-store'})
          .then(res => {
            found.push({
              name: `Unbekanntes Gerät (${ip})`,
              ip, type: "http"
            });
          })
          .catch(()=>{})
      );
      requests.push(
        fetch(`http://${ip}:${port}/rpc/Sys.GetStatus`, {mode:'no-cors', cache:'no-store'})
          .then(res => {
            found.push({
              name: `Shelly (Plus) (${ip})`,
              ip, type: "shelly"
            });
          })
          .catch(()=>{})
      );
    }
    if (i % 10 === 0) {
      await Promise.all(requests);
      requests = [];
    }
  }
  await Promise.all(requests);
  return found.filter((d,i,self)=>self.findIndex(e=>e.ip===d.ip)===i);
}

// --- BLE Discovery (Govee, Yeelight BLE, etc.) ---
async function bleScan() {
  try {
    const dev = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: []
    });
    // Zeige vollständigen Namen und MAC-Adresse (falls verfügbar)
    return [{
      name: dev.name || 'BLE-Lampe',
      id: dev.id,
      type: 'govee_ble',
      displayName: `${dev.name || 'BLE-Lampe'}${dev.id ? ' (' + dev.id + ')' : ''}`
    }];
  } catch (e) {
    return [];
  }
}

// --- QR Discovery ---
async function qrScan() {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const qrDiv = document.getElementById('qr-scan-video');
    qrDiv.innerHTML = '';
    qrDiv.classList.remove('hidden');
    qrDiv.appendChild(video);

    navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}})
      .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let running = true;

        function scan() {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            if (code) {
              running = false;
              stream.getTracks().forEach(track => track.stop());
              qrDiv.classList.add('hidden');
              resolve(code.data);
              return;
            }
          }
          if (running) requestAnimationFrame(scan);
        }
        scan();
      }).catch(err => {
        qrDiv.classList.add('hidden');
        reject(err);
      });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindTabs();
  bindSettingsModal();
  bindAddLamp();
  renderSavedLamps();
});

function bindTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
      tab.classList.add('tab-active');
      const name = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
      document.getElementById(`${name}-tab`).classList.remove('hidden');
    });
  });
}

function bindSettingsModal() {
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
  });
  document.getElementById('close-settings-modal').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });
}

// --- Lampe hinzufügen Modal ---
function bindAddLamp() {
  const openBtn = document.getElementById('add-lamp');
  const modal = document.getElementById('add-lamp-modal');
  const closeBtn = document.getElementById('close-add-lamp-modal');

  openBtn.onclick = () => {
    modal.classList.remove('hidden');
    showModalTab('find');
    document.getElementById('scan-results').innerHTML = '';
  };
  closeBtn.onclick = () => {
    modal.classList.add('hidden');
    document.getElementById('qr-scan-video').classList.add('hidden');
  };

  document.getElementById('modal-tab-find').onclick = () => showModalTab('find');
  document.getElementById('modal-tab-manual').onclick = () => showModalTab('manual');

  // --- LAN-Scan Button ---
  document.getElementById('btn-lan-scan').onclick = async () => {
    const btn = document.getElementById('btn-lan-scan');
    btn.disabled = true; btn.textContent = 'Suche läuft...';
    // Prüfe, ob scan-results.json existiert (vom Hilfsprogramm)
    let results = [];
    try {
      const res = await fetch('scan-results.json', {cache:'no-store'});
      if (res.ok) {
        results = await res.json();
      }
    } catch {}
    if (results.length === 0) {
      // Popup mit verständlicher Anleitung anzeigen
      alert('Kein Gerät gefunden.\n\nTipp: Um Lampen automatisch zu finden, lade das kleine Hilfsprogramm für den Netzwerkscan von unserer Webseite herunter und führe es auf deinem Computer aus. Danach werden die gefundenen Geräte hier angezeigt.');
    }
    btn.disabled = false; btn.textContent = 'Automatischer LAN-Scan';
    showScanResults(results, modal);
  };

  // --- BLE-Scan Button ---
  document.getElementById('btn-ble-scan').onclick = async () => {
    const btn = document.getElementById('btn-ble-scan');
    btn.disabled = true; btn.textContent = 'Bluetooth-Scan läuft...';
    const results = await bleScan();
    btn.disabled = false; btn.textContent = 'Bluetooth-Scan';
    showScanResults(results, modal);
  };

  // --- QR-Scan Button ---
  document.getElementById('btn-qr-scan').onclick = async () => {
    const btn = document.getElementById('btn-qr-scan');
    btn.disabled = true; btn.textContent = 'QR-Scan läuft...';
    try {
      const result = await qrScan();
      let data = {};
      try { data = JSON.parse(result); }
      catch { data = { name: result }; }
      if (data && data.name && data.type) {
        addDevice({
          id: data.id || ('lamp-' + Date.now()),
          name: data.name,
          type: data.type,
          ip: data.ip || undefined
        });
        modal.classList.add('hidden');
      } else {
        alert('QR-Code erkannt, aber keine vollständigen Lampendaten.');
      }
    } catch {
      alert('QR-Scan abgebrochen oder fehlgeschlagen.');
    }
    btn.disabled = false; btn.textContent = 'QR-Code scannen';
    document.getElementById('qr-scan-video').classList.add('hidden');
  };

  // --- Manuelles Hinzufügen ---
  document.getElementById('manual-add-form').onsubmit = e => {
    e.preventDefault();
    const lamp = {
      id: 'lamp-' + Date.now(),
      name: document.getElementById('manual-name').value,
      type: document.getElementById('manual-type').value,
      ip: document.getElementById('manual-ip').value || undefined
    };
    addDevice(lamp);
    modal.classList.add('hidden');
    e.target.reset();
  };
}

function showModalTab(which) {
  document.getElementById('modal-find').classList.toggle('hidden', which !== 'find');
  document.getElementById('modal-manual').classList.toggle('hidden', which !== 'manual');
  document.getElementById('modal-tab-find').classList.toggle('text-indigo-700', which === 'find');
  document.getElementById('modal-tab-find').classList.toggle('border-indigo-600', which === 'find');
  document.getElementById('modal-tab-manual').classList.toggle('text-indigo-700', which === 'manual');
  document.getElementById('modal-tab-manual').classList.toggle('border-indigo-600', which === 'manual');
}

function showScanResults(results, modal) {
  const cont = document.getElementById('scan-results');
  cont.innerHTML = results.length
    ? results.map(dev =>
        `<div class="p-2 bg-gray-50 rounded flex justify-between items-center">
           <div>
             <div class="font-bold">${dev.displayName || dev.name}</div>
             <div class="text-xs text-gray-500">${dev.type}${dev.ip ? ', ' + dev.ip : ''}</div>
           </div>
           <button class="add-scan-result px-3 py-1 bg-purple-600 text-white rounded" 
             data-ip="${dev.ip || ''}" data-type="${dev.type}" data-name="${dev.name}" ${dev.id ? `data-id="${dev.id}"` : ''}>
             Hinzufügen
           </button>
         </div>`).join('')
    : '<div class="text-gray-400 text-sm p-2">Keine Geräte gefunden.</div>';
  cont.querySelectorAll('.add-scan-result').forEach(btn =>
    btn.onclick = () => {
      const lamp = {
        id: btn.dataset.id || ('lamp-' + Date.now()),
        name: btn.dataset.name,
        type: btn.dataset.type,
        ip: btn.dataset.ip || undefined
      };
      // Nach dem Hinzufügen: Dialog für eigenen Namen anzeigen
      const userName = prompt('Wie soll dieses Gerät heißen?', lamp.name || 'Meine Lampe');
      if (userName) lamp.name = userName;
      addDevice(lamp);
      modal.classList.add('hidden');
    });
}

function addDevice(lamp) {
  const list = loadConfig('schlaflichtDeviceList') || [];
  list.push(lamp);
  saveConfig('schlaflichtDeviceList', list);
  renderSavedLamps();
}
function renderSavedLamps() {
  const container = document.querySelector('#lamps-tab .grid');
  if (!container) return;
  container.innerHTML = '';
  const lamps = loadConfig('schlaflichtDeviceList') || [];
  if (lamps.length === 0) {
    addLampCard(container, {name:'Nachtlicht Kinderzimmer 1', type:'dummy', isOn:true});
    addLampCard(container, {name:'Nachtlicht Kinderzimmer 2', type:'dummy', isOn:false});
  } else {
    lamps.forEach(lamp => addLampCard(container, lamp));
  }
}
function addLampCard(parent, lamp) {
  // Standardmäßig ausgeschaltet, wenn nicht gesetzt
  const isOn = lamp.isOn !== undefined ? lamp.isOn : false;
  const card = document.createElement('div');
  card.className = 'lamp-card bg-white rounded-xl p-5 shadow-sm';
  card.dataset.id = lamp.id || '';
  card.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <div>
        <h3 class="font-bold text-lg">${lamp.name}</h3>
        <p class="text-sm text-gray-500">${lamp.type === 'dummy' ? 'Demo-Lampe' : lamp.type === 'shelly' ? 'Shelly (LAN)' : lamp.type === 'govee_ble' ? 'Govee BLE' : lamp.type}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-on px-3 py-1 rounded border bg-gray-200 text-gray-700 ${isOn ? 'bg-gray-600 text-white font-bold' : ''}">An</button>
        <button class="btn-off px-3 py-1 rounded border bg-gray-200 text-gray-700 ${!isOn ? 'bg-gray-600 text-white font-bold' : ''}">Aus</button>
      </div>
    </div>
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-1">Helligkeit</label>
      <input type="range" min="1" max="100" value="50"
             class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
    </div>
    <div class="flex justify-between text-sm mt-2">
      <button class="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
        <i class="fas fa-clock mr-1"></i> Timer
      </button>
      <button class="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 transition" data-delete>
        <i class="fas fa-trash mr-1"></i> Löschen
      </button>
    </div>
  `;
  // An/Aus-Button-Logik
  const btnOn = card.querySelector('.btn-on');
  const btnOff = card.querySelector('.btn-off');
  function updateOnOffUI(on) {
    btnOn.classList.toggle('bg-gray-600', on);
    btnOn.classList.toggle('text-white', on);
    btnOn.classList.toggle('font-bold', on);
    btnOn.classList.toggle('bg-gray-200', !on);
    btnOn.classList.toggle('text-gray-700', !on);
    btnOff.classList.toggle('bg-gray-600', !on);
    btnOff.classList.toggle('text-white', !on);
    btnOff.classList.toggle('font-bold', !on);
    btnOff.classList.toggle('bg-gray-200', on);
    btnOff.classList.toggle('text-gray-700', on);
    card.querySelector('p.text-gray-500').textContent = on ? (
      lamp.type === 'dummy' ? 'Demo-Lampe' :
      lamp.type === 'shelly' ? 'Shelly (LAN)' :
      lamp.type === 'govee_ble' ? 'Govee BLE' :
      lamp.type
    ) : 'Ausgeschaltet';
  }
  btnOn.addEventListener('click', async () => {
    lamp.isOn = true;
    updateOnOffUI(true);
    await setLampState(lamp, true);
    saveLampState(lamp);
  });
  btnOff.addEventListener('click', async () => {
    lamp.isOn = false;
    updateOnOffUI(false);
    await setLampState(lamp, false);
    saveLampState(lamp);
  });
  updateOnOffUI(isOn);
  card.querySelector('input[type="range"]').addEventListener('input', e => {
    // Hier später echte Adapter-Logik
  });
  card.querySelector('button[data-delete]').addEventListener('click', () => {
    deleteLamp(card.dataset.id);
  });
  parent.appendChild(card);
}

// Hilfsfunktion: Lampenstatus speichern
function saveLampState(lamp) {
  let list = loadConfig('schlaflichtDeviceList') || [];
  list = list.map(l => l.id === lamp.id ? { ...l, isOn: lamp.isOn } : l);
  saveConfig('schlaflichtDeviceList', list);
}

// Hilfsfunktion: Lampenstatus setzen (Dummy, Shelly, Govee BLE)
async function setLampState(lamp, on) {
  if (lamp.type === 'dummy') return;
  if (lamp.type === 'shelly' && lamp.ip) {
    try {
      await fetch(`http://${lamp.ip}/light/0?turn=${on ? 'on' : 'off'}`, { method: 'POST' });
    } catch {}
  }
  if (lamp.type === 'govee_ble' && lamp.id) {
    try {
      // Govee BLE: Die meisten Modelle nutzen Service 0xFFE0 und Characteristic 0xFFE1
      // Wir nutzen acceptAllDevices:true und optionalServices:[0xFFE0]
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [0xFFE0]
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(0xFFE0);
      const char = await service.getCharacteristic(0xFFE1);
      // Ein/Aus-Befehl senden (z.B. 0x33010100000000000000000000000000 für An, 0x33010000000000000000000000000000 für Aus)
      const onCmd = new Uint8Array([0x33, 0x01, 0x01, 0,0,0,0,0,0,0,0,0,0,0,0,0]);
      const offCmd = new Uint8Array([0x33, 0x01, 0x00, 0,0,0,0,0,0,0,0,0,0,0,0,0]);
      await char.writeValueWithoutResponse(on ? onCmd : offCmd);
      await server.disconnect();
    } catch (e) {
      alert('Bluetooth-Steuerung nicht möglich. Stelle sicher, dass du die Verbindung zum Gerät erlaubst und das Gerät in Reichweite ist.\n\nHinweis: Nicht alle Govee-Modelle unterstützen Web Bluetooth.');
    }
  }
}
function deleteLamp(id) {
  let list = loadConfig('schlaflichtDeviceList') || [];
  list = list.filter(l => l.id !== id);
  saveConfig('schlaflichtDeviceList', list);
  renderSavedLamps();
}
