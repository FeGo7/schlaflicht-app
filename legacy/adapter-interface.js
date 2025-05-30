export class LampAdapter {
  static async discover() { return []; }
  async getState() { return {on:false, level:0}; }
  async setState(state) {}
}