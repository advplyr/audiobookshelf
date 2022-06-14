"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
/* ABORT SIGNAL */
var AbortSignal = /** @class */ (function () {
  function AbortSignal() {
    /* VARIABLES */
    this.aborted = false;
    this.listeners = {};
  }
  /* EVENTS API */
  AbortSignal.prototype.addEventListener = function (event, listener) {
    var listeners = this.listeners[event] || (this.listeners[event] = []);
    listeners.push(listener);
  };
  AbortSignal.prototype.removeEventListener = function (event, listener) {
    var listeners = this.listeners[event];
    if (!listeners)
      return;
    listeners.splice(listeners.indexOf(listener), 1);
  };
  AbortSignal.prototype.dispatchEvent = function (event) {
    var listeners = this.listeners[event];
    if (!listeners)
      return true;
    listeners.slice().forEach(function (listener) { return listener(); });
    return true;
  };
  /* API */
  AbortSignal.prototype.abort = function () {
    if (this.aborted)
      return;
    this.aborted = true;
    this.dispatchEvent('abort');
  };
  return AbortSignal;
}());
/* EXPORT */
exports.default = AbortSignal;
