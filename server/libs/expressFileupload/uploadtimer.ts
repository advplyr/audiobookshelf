class UploadTimer {
  declare timeout: number;
  declare callback: () => void;
  declare timer: NodeJS.Timeout | null;

  /**
   * @constructor
   * @param {number} timeout - timer timeout in msecs. 
   * @param {Function} callback - callback to run when timeout reached.
   */
  constructor(timeout = 0, callback: () => void = () => {}) {
    this.timeout = timeout;
    this.callback = callback;
    this.timer = null;
  }

  clear() {
    // Node treats a null timer as a no-op.
    clearTimeout(this.timer!);
  }

  set() {
    // Do not start a timer if zero timeout or it hasn't been set. 
    if (!this.timeout) return false;
    this.clear();
    this.timer = setTimeout(this.callback, this.timeout);
    return true;
  }
}

export = UploadTimer;
