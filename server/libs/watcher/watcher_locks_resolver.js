"use strict";
/* WATCHER LOCKS RESOLVER */
Object.defineProperty(exports, "__esModule", { value: true });
// Registering a single interval scales much better than registering N timeouts
// Timeouts are respected within the interval margin
const WatcherLocksResolver = {
    /* VARIABLES */
    interval: 100,
    intervalId: undefined,
    fns: new Map(),
    /* LIFECYCLE */
    init: () => {
        if (WatcherLocksResolver.intervalId)
            return;
        WatcherLocksResolver.intervalId = setInterval(WatcherLocksResolver.resolve, WatcherLocksResolver.interval);
    },
    reset: () => {
        if (!WatcherLocksResolver.intervalId)
            return;
        clearInterval(WatcherLocksResolver.intervalId);
        delete WatcherLocksResolver.intervalId;
    },
    /* API */
    add: (fn, timeout) => {
        WatcherLocksResolver.fns.set(fn, Date.now() + timeout);
        WatcherLocksResolver.init();
    },
    remove: (fn) => {
        WatcherLocksResolver.fns.delete(fn);
    },
    resolve: () => {
        if (!WatcherLocksResolver.fns.size)
            return WatcherLocksResolver.reset();
        const now = Date.now();
        for (const [fn, timestamp] of WatcherLocksResolver.fns) {
            if (timestamp >= now)
                continue; // We should still wait some more for this
            WatcherLocksResolver.remove(fn);
            fn();
        }
    }
};
/* EXPORT */
exports.default = WatcherLocksResolver;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlcl9sb2Nrc19yZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy93YXRjaGVyX2xvY2tzX3Jlc29sdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFDQSw0QkFBNEI7O0FBRTVCLCtFQUErRTtBQUMvRSxvREFBb0Q7QUFFcEQsTUFBTSxvQkFBb0IsR0FBRztJQUUzQixlQUFlO0lBRWYsUUFBUSxFQUFFLEdBQUc7SUFDYixVQUFVLEVBQUUsU0FBdUM7SUFDbkQsR0FBRyxFQUFFLElBQUksR0FBRyxFQUFxQjtJQUVqQyxlQUFlO0lBRWYsSUFBSSxFQUFFLEdBQVMsRUFBRTtRQUVmLElBQUssb0JBQW9CLENBQUMsVUFBVTtZQUFHLE9BQU87UUFFOUMsb0JBQW9CLENBQUMsVUFBVSxHQUFHLFdBQVcsQ0FBRyxvQkFBb0IsQ0FBQyxPQUFPLEVBQUUsb0JBQW9CLENBQUMsUUFBUSxDQUFFLENBQUM7SUFFaEgsQ0FBQztJQUVELEtBQUssRUFBRSxHQUFTLEVBQUU7UUFFaEIsSUFBSyxDQUFDLG9CQUFvQixDQUFDLFVBQVU7WUFBRyxPQUFPO1FBRS9DLGFBQWEsQ0FBRyxvQkFBb0IsQ0FBQyxVQUFVLENBQUUsQ0FBQztRQUVsRCxPQUFPLG9CQUFvQixDQUFDLFVBQVUsQ0FBQztJQUV6QyxDQUFDO0lBRUQsU0FBUztJQUVULEdBQUcsRUFBRSxDQUFFLEVBQVksRUFBRSxPQUFlLEVBQVMsRUFBRTtRQUU3QyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFHLEdBQUcsT0FBTyxDQUFFLENBQUM7UUFFM0Qsb0JBQW9CLENBQUMsSUFBSSxFQUFHLENBQUM7SUFFL0IsQ0FBQztJQUVELE1BQU0sRUFBRSxDQUFFLEVBQVksRUFBUyxFQUFFO1FBRS9CLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUcsRUFBRSxDQUFFLENBQUM7SUFFekMsQ0FBQztJQUVELE9BQU8sRUFBRSxHQUFTLEVBQUU7UUFFbEIsSUFBSyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxJQUFJO1lBQUcsT0FBTyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUcsQ0FBQztRQUUzRSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFHLENBQUM7UUFFeEIsS0FBTSxNQUFNLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxJQUFJLG9CQUFvQixDQUFDLEdBQUcsRUFBRztZQUV4RCxJQUFLLFNBQVMsSUFBSSxHQUFHO2dCQUFHLFNBQVMsQ0FBQywwQ0FBMEM7WUFFNUUsb0JBQW9CLENBQUMsTUFBTSxDQUFHLEVBQUUsQ0FBRSxDQUFDO1lBRW5DLEVBQUUsRUFBRyxDQUFDO1NBRVA7SUFFSCxDQUFDO0NBRUYsQ0FBQztBQUVGLFlBQVk7QUFFWixrQkFBZSxvQkFBb0IsQ0FBQyJ9