/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing. The function also has a property 'clear' 
 * that is a function which will clear the timer to prevent previously scheduled executions. 
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */
function debounce<Receiver, Args extends unknown[], Result>(func: (this: Receiver, ...args: Args) => Result, wait?: number | null, immediate?: boolean) {
  let timeout: NodeJS.Timeout | null | undefined;
  let args: Args | null;
  const state: { context: Receiver | null } = { context: null };
  let timestamp: number;
  let result: Result | undefined;
  const delay = wait ?? 100;

  function later() {
    var last = Date.now() - timestamp;

    if (last < delay && last >= 0) {
      timeout = setTimeout(later, delay - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(state.context as Receiver, args as Args);
        state.context = args = null;
      }
    }
  };

  function debounced(this: Receiver, ...callArgs: Args) {
    state.context = this;
    args = callArgs;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, delay);
    if (callNow) {
      result = func.apply(this, callArgs);
      state.context = args = null;
    }

    return result;
  }

  debounced.clear = function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  // After a leading call, apply receives null arguments if flushed before the timer expires.
  debounced.flush = function () {
    if (timeout) {
      result = func.apply(state.context as Receiver, args as Args);
      state.context = args = null;

      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
};

// Adds compatibility for ES modules
debounce.debounce = debounce;

export = debounce;
