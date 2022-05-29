"use strict";
/* IMPORT */
Object.defineProperty(exports, "__esModule", { value: true });
/* WATCHER STATS */
// An even more memory-efficient representation of the useful subset of stats objects
class WatcherStats {
    /* CONSTRUCTOR */
    constructor(stats) {
        this.ino = stats.ino;
        this.size = stats.size;
        this.atimeMs = stats.atimeMs;
        this.mtimeMs = stats.mtimeMs;
        this.ctimeMs = stats.ctimeMs;
        this.birthtimeMs = stats.birthtimeMs;
        this._isFile = stats.isFile();
        this._isDirectory = stats.isDirectory();
        this._isSymbolicLink = stats.isSymbolicLink();
    }
    /* API */
    isFile() {
        return this._isFile;
    }
    isDirectory() {
        return this._isDirectory;
    }
    isSymbolicLink() {
        return this._isSymbolicLink;
    }
}
/* EXPORT */
exports.default = WatcherStats;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlcl9zdGF0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy93YXRjaGVyX3N0YXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFDQSxZQUFZOztBQUlaLG1CQUFtQjtBQUVuQixxRkFBcUY7QUFFckYsTUFBTSxZQUFZO0lBY2hCLGlCQUFpQjtJQUVqQixZQUFjLEtBQVk7UUFFeEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUN2QixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDN0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQzdCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUM7UUFDckMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFHLENBQUM7UUFDL0IsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsV0FBVyxFQUFHLENBQUM7UUFDekMsSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFHLENBQUM7SUFFakQsQ0FBQztJQUVELFNBQVM7SUFFVCxNQUFNO1FBRUosT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBRXRCLENBQUM7SUFFRCxXQUFXO1FBRVQsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBRTNCLENBQUM7SUFFRCxjQUFjO1FBRVosT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBRTlCLENBQUM7Q0FFRjtBQUVELFlBQVk7QUFFWixrQkFBZSxZQUFZLENBQUMifQ==