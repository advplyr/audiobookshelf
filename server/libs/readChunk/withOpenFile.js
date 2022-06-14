'use strict'

const fs = require('fs')
const pify = require('./pify')
const pTry = (fn, ...arguments_) => new Promise(resolve => {
  resolve(fn(...arguments_));
})
const pFinally = (promise, onFinally) => {
  onFinally = onFinally || (() => { });

  return promise.then(
    val => new Promise(resolve => {
      resolve(onFinally());
    }).then(() => val),
    err => new Promise(resolve => {
      resolve(onFinally());
    }).then(() => {
      throw err;
    })
  );
};


const fsP = pify(fs)

module.exports = (...args) => {
  const callback = args.pop()
  return fsP
    .open(...args)
    .then(fd => pFinally(pTry(callback, fd), _ => fsP.close(fd)))
}

module.exports.sync = (...args) => {
  const callback = args.pop()
  const fd = fs.openSync(...args)
  try {
    return callback(fd)
  } finally {
    fs.closeSync(fd)
  }
}
