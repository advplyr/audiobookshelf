// SOURCE: https://github.com/snovakovic/fast-sort
// LICENSE: https://github.com/snovakovic/fast-sort/blob/master/LICENSE

type Selector<Item> = Extract<keyof Item, string> | ((item: Item) => unknown)
type Order = 1 | -1
type Compare<Left = unknown> = (left: Left, right: Left, order: Order) => number
export type SortDirection<Item> = { asc?: Selector<Item>; desc?: Selector<Item>; comparer?: Compare<never> }
type SortBy<Item> = Selector<Item> | SortDirection<Item>
type SortConfig<Item> = SortBy<Item> | SortBy<Item>[] | true

// >>> INTERFACES <<<
// >>> HELPERS <<<
const api = (function () {
    // Custom comparers receive keys selected by the caller.
    var castComparer = function (comparer: Compare<never>): Compare { return function (a, b, order) { return (comparer as Compare)(a, b, order) * order; }; };
    var throwInvalidConfigErrorIfTrue = function (condition: unknown, context: string) {
        if (condition)
            throw Error("Invalid sort config: " + context);
    };
    var unpackObjectSorter = function <Item>(sortByObj: SortDirection<Item>) {
        var _a = sortByObj || {}, asc = _a.asc, desc = _a.desc;
        var order: Order = asc ? 1 : -1;
        var sortBy = (asc || desc);
        // Validate object config
        if (!sortBy) throw Error('Invalid sort config: Expected `asc` or `desc` property');
        throwInvalidConfigErrorIfTrue(asc && desc, 'Ambiguous object with `asc` and `desc` config properties');
        var comparer = sortByObj.comparer && castComparer(sortByObj.comparer);
        return { order: order, sortBy: sortBy, comparer: comparer };
    };
    // >>> SORTERS <<<
    var multiPropertySorterProvider = function <Item>(defaultComparer: Compare) {
        return function multiPropertySorter(sortBy: SortBy<Item>, sortByArr: SortBy<Item>[], depth: number, order: Order, comparer: Compare, a: Item, b: Item): number {
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
    function getSortStrategy<Item>(sortBy: SortConfig<Item> | undefined, comparer: Compare, order: Order): (a: Item, b: Item) => number {
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
            var multiPropSorter_1 = multiPropertySorterProvider<Item>(comparer);
            return function (a, b) { return multiPropSorter_1(sortBy[0], sortBy, 1, order, comparer, a, b); };
        }
        // Unpack object config to get actual sorter strategy
        var objectSorterConfig = unpackObjectSorter(sortBy);
        return getSortStrategy(objectSorterConfig.sortBy, objectSorterConfig.comparer || comparer, objectSorterConfig.order);
    }
    var sortArray = function <Item>(order: Order, ctx: Item[], sortBy: SortConfig<Item> | undefined, comparer: Compare) {
        if (!Array.isArray(ctx)) {
            return ctx;
        }
        // Unwrap sortBy if array with only 1 value to get faster sort strategy
        if (Array.isArray(sortBy) && sortBy.length < 2) {
            sortBy = sortBy[0];
        }
        return ctx.sort(getSortStrategy(sortBy, comparer, order));
    };
    function createNewSortInstance(opts: { comparer: Compare<never>; inPlaceSorting?: boolean }) {
        var comparer = castComparer(opts.comparer);
        return function <Item>(_ctx: Item[]) {
            var ctx = Array.isArray(_ctx) && !opts.inPlaceSorting
                ? _ctx.slice()
                : _ctx;
            return {
                asc: function (sortBy?: SortConfig<Item>) {
                    return sortArray(1, ctx, sortBy, comparer);
                },
                desc: function (sortBy?: SortConfig<Item>) {
                    return sortArray(-1, ctx, sortBy, comparer);
                },
                by: function (sortBy?: SortConfig<Item>) {
                    return sortArray(1, ctx, sortBy, comparer);
                },
            };
        };
    }
    // Relational operators apply JavaScript coercion to non-null comparison keys.
    var defaultComparer: Compare = function (a, b, order) {
        if (a == null)
            return order;
        if (b == null)
            return -order;
        if ((a as number) < (b as number))
            return -1;
        if ((a as number) > (b as number))
            return 1;
        return 0;
    };
    const sort = createNewSortInstance({
        comparer: defaultComparer,
    });
    const inPlaceSort = createNewSortInstance({
        comparer: defaultComparer,
        inPlaceSorting: true,
    });

    return { createNewSortInstance, inPlaceSort, sort };
})();

export const { createNewSortInstance, inPlaceSort, sort } = api;
