/* LANG */
const Lang = {
    isFunction: (x: unknown) => {
        return typeof x === 'function';
    },
    isString: (x: unknown) => {
        return typeof x === 'string';
    },
    isUndefined: (x: unknown) => {
        return typeof x === 'undefined';
    }
};
/* EXPORT */
export default Lang;
