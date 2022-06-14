// SOURCE: https://github.com/snovakovic/fast-sort
// LICENSE: https://github.com/snovakovic/fast-sort/blob/master/LICENSE

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global['fast-sort'] = {}));
}(this, (function (exports) {
    'use strict';

    // >>> INTERFACES <<<
    // >>> HELPERS <<<
    var castComparer = function (comparer) { return function (a, b, order) { return comparer(a, b, order) * order; }; };
    var throwInvalidConfigErrorIfTrue = function (condition, context) {
        if (condition)
            throw Error("Invalid sort config: " + context);
    };
    var unpackObjectSorter = function (sortByObj) {
        var _a = sortByObj || {}, asc = _a.asc, desc = _a.desc;
        var order = asc ? 1 : -1;
        var sortBy = (asc || desc);
        // Validate object config
        throwInvalidConfigErrorIfTrue(!sortBy, 'Expected `asc` or `desc` property');
        throwInvalidConfigErrorIfTrue(asc && desc, 'Ambiguous object with `asc` and `desc` config properties');
        var comparer = sortByObj.comparer && castComparer(sortByObj.comparer);
        return { order: order, sortBy: sortBy, comparer: comparer };
    };
    // >>> SORTERS <<<
    var multiPropertySorterProvider = function (defaultComparer) {
        return function multiPropertySorter(sortBy, sortByArr, depth, order, comparer, a, b) {
            var valA;
            var valB;
            if (typeof sortBy === 'string') {
                valA = a[sortBy];
                valB = b[sortBy];
            }
            else if (typeof sortBy === 'function') {
                valA = sortBy(a);
                valB = sortBy(b);
            }
            else {
                var objectSorterConfig = unpackObjectSorter(sortBy);
                return multiPropertySorter(objectSorterConfig.sortBy, sortByArr, depth, objectSorterConfig.order, objectSorterConfig.comparer || defaultComparer, a, b);
            }
            var equality = comparer(valA, valB, order);
            if ((equality === 0 || (valA == null && valB == null)) &&
                sortByArr.length > depth) {
                return multiPropertySorter(sortByArr[depth], sortByArr, depth + 1, order, comparer, a, b);
            }
            return equality;
        };
    };
    function getSortStrategy(sortBy, comparer, order) {
        // Flat array sorter
        if (sortBy === undefined || sortBy === true) {
            return function (a, b) { return comparer(a, b, order); };
        }
        // Sort list of objects by single object key
        if (typeof sortBy === 'string') {
            throwInvalidConfigErrorIfTrue(sortBy.includes('.'), 'String syntax not allowed for nested properties.');
            return function (a, b) { return comparer(a[sortBy], b[sortBy], order); };
        }
        // Sort list of objects by single function sorter
        if (typeof sortBy === 'function') {
            return function (a, b) { return comparer(sortBy(a), sortBy(b), order); };
        }
        // Sort by multiple properties
        if (Array.isArray(sortBy)) {
            var multiPropSorter_1 = multiPropertySorterProvider(comparer);
            return function (a, b) { return multiPropSorter_1(sortBy[0], sortBy, 1, order, comparer, a, b); };
        }
        // Unpack object config to get actual sorter strategy
        var objectSorterConfig = unpackObjectSorter(sortBy);
        return getSortStrategy(objectSorterConfig.sortBy, objectSorterConfig.comparer || comparer, objectSorterConfig.order);
    }
    var sortArray = function (order, ctx, sortBy, comparer) {
        var _a;
        if (!Array.isArray(ctx)) {
            return ctx;
        }
        // Unwrap sortBy if array with only 1 value to get faster sort strategy
        if (Array.isArray(sortBy) && sortBy.length < 2) {
            _a = sortBy, sortBy = _a[0];
        }
        return ctx.sort(getSortStrategy(sortBy, comparer, order));
    };
    function createNewSortInstance(opts) {
        var comparer = castComparer(opts.comparer);
        return function (_ctx) {
            var ctx = Array.isArray(_ctx) && !opts.inPlaceSorting
                ? _ctx.slice()
                : _ctx;
            return {
                asc: function (sortBy) {
                    return sortArray(1, ctx, sortBy, comparer);
                },
                desc: function (sortBy) {
                    return sortArray(-1, ctx, sortBy, comparer);
                },
                by: function (sortBy) {
                    return sortArray(1, ctx, sortBy, comparer);
                },
            };
        };
    }
    var defaultComparer = function (a, b, order) {
        if (a == null)
            return order;
        if (b == null)
            return -order;
        if (a < b)
            return -1;
        if (a > b)
            return 1;
        return 0;
    };
    var sort = createNewSortInstance({
        comparer: defaultComparer,
    });
    var inPlaceSort = createNewSortInstance({
        comparer: defaultComparer,
        inPlaceSorting: true,
    });

    exports.createNewSortInstance = createNewSortInstance;
    exports.inPlaceSort = inPlaceSort;
    exports.sort = sort;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
