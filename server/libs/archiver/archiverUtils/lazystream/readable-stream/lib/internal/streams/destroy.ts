import type { EventEmitter } from 'node:events';

type Callback = (error?: Error | null) => void;

interface LegacyStream extends Pick<EventEmitter, 'emit'> {
  _readableState?: { destroyed: boolean; reading: boolean; ended: boolean; endEmitted: boolean };
  _writableState?: { destroyed: boolean; ended: boolean; ending: boolean; finished: boolean; errorEmitted: boolean };
  _destroy(error: Error | null, callback: Callback): void;
}

/*<replacement>*/

// var pna = require('process-nextick-args');
var pna = process
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy<Stream extends LegacyStream>(this: Stream, err?: Error | null, cb?: Callback): Stream {
  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      pna.nextTick(emitErrorNT, this, err);
    }
    return this;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, (err) => {
    if (!cb && err) {
      pna.nextTick(emitErrorNT, this, err);
      if (this._writableState) {
        this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });

  return this;
}

function undestroy(this: LegacyStream) {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self: LegacyStream, err: Error) {
  self.emit('error', err);
}

export = {
  destroy: destroy,
  undestroy: undestroy
};
