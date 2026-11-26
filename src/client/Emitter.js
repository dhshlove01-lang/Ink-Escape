export class Emitter {
  constructor() {
    this._h = new Map();
  }

  on(type, fn) {
    if (!this._h.has(type)) this._h.set(type, new Set());
    this._h.get(type).add(fn);
    return () => this._h.get(type)?.delete(fn);
  }

  emit(type, data) {
    const set = this._h.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(data);
      } catch (e) {
        console.error(`[${type}]`, e);
      }
    }
  }

  clear() {
    this._h.clear();
  }
}
