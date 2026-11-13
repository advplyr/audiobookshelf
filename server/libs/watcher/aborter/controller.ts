/* IMPORT */
import AbortSignal from "./signal";

/* ABORT CONTROLLER */
class AbortController {
  signal: AbortSignal;

  constructor() {
    this.signal = new AbortSignal();
  }

  /* API */
  abort() {
    return this.signal.abort();
  }
}

/* EXPORT */
const exported = Object.assign(AbortController, { default: AbortController });
Object.defineProperty(exported, "__esModule", { value: true });
export = exported;
