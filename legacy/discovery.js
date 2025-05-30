import { ShellyAdapter } from './adapters/shelly.js';

export async function discoverAll() {
  const devices = [];
  const shelly = await ShellyAdapter.discover();
  shelly.forEach(d => devices.push({ ...d, adapter: 'shelly' }));
  return devices;
}