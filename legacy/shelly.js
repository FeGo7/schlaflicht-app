import { LampAdapter } from '../adapter-interface.js';

export class ShellyAdapter extends LampAdapter {
  constructor(ip) {
    super();
    this.ip = ip;
  }
  static async discover() {
    const found = [];
    const subnet = location.hostname.split('.').slice(0,3).join('.');
    for (let i=1; i<255; i+=5) {
      const url = `http://${subnet}.${i}/light/0`;
      try {
        const res = await fetch(url, { method:'GET', mode:'no-cors' });
        if (res.ok) {
          const j = await res.json();
          found.push({ id: url, label: j.name || url, type:'shelly' });
        }
      } catch {}
    }
    return found;
  }
  async getState(){
    const res = await fetch(`${this.ip}/light/0`);
    const j = await res.json();
    return { on: j.output, level: Math.round(j.brightness*100) };
  }
  async setState({on, level}){
    const p = new URLSearchParams();
    if (on!==undefined) p.set('turn', on?'on':'off');
    if (level!==undefined) p.set('brightness', (level/100).toFixed(2));
    await fetch(`${this.ip}/light/0?${p}`,{method:'POST'});
  }
}