/* ABORT SIGNAL */
type Listener = () => void;

export default class AbortSignal {
  aborted: boolean;
  listeners: Record<string, Listener[]>;

  constructor() {
    this.aborted = false;
    this.listeners = {};
  }

  /* EVENTS API */
  addEventListener(event: string, listener: Listener) {
    const listeners = this.listeners[event] || (this.listeners[event] = []);
    listeners.push(listener);
  }

  removeEventListener(event: string, listener: Listener) {
    const listeners = this.listeners[event];
    if (!listeners)
      return;
    listeners.splice(listeners.indexOf(listener), 1);
  }

  dispatchEvent(event: string) {
    const listeners = this.listeners[event];
    if (!listeners)
      return true;
    listeners.slice().forEach(function (listener) { return listener(); });
    return true;
  }

  /* API */
  abort() {
    if (this.aborted)
      return;
    this.aborted = true;
    this.dispatchEvent('abort');
  }
}
