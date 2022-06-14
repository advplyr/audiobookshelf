"use strict";
/* IMPORT */
var signal_1 = require("./signal");
/* ABORT CONTROLLER */
var AbortController = /** @class */ (function () {
  function AbortController() {
    /* VARIABLES */
    this.signal = new signal_1.default();
  }
  /* API */
  AbortController.prototype.abort = function () {
    return this.signal.abort();
  };
  return AbortController;
}());
/* EXPORT */
module.exports = AbortController;
module.exports.default = AbortController;
Object.defineProperty(module.exports, "__esModule", { value: true });
