import path from "path-webpack";

/**
 * Creates a Path object for parsing and manipulation of a path strings
 *
 * Uses a polyfill for Nodejs path: https://nodejs.org/api/path.html
 * @param	{string} pathString	a url string (relative or absolute)
 * @class
 */
class Path {
	constructor(pathString) {
		var protocol;
		var parsed;

		protocol = pathString.indexOf("://");
		if (protocol > -1) {
			pathString = new URL(pathString).pathname;
		}

		parsed = this.parse(pathString);

		this.path = pathString;

		if (this.isDirectory(pathString)) {
			this.directory = pathString;
		} else {
			this.directory = parsed.dir + "/";
		}

		this.filename = parsed.base;
		this.extension = parsed.ext.slice(1);

	}

	/**
	 * Parse the path: https://nodejs.org/api/path.html#path_path_parse_path
	 * @param	{string} what
	 * @returns {object}
	 */
	parse (what) {
		return path.parse(what);
	}

	/**
	 * @param	{string} what
	 * @returns {boolean}
	 */
	isAbsolute (what) {
		return path.isAbsolute(what || this.path);
	}

	/**
	 * Check if path ends with a directory
	 * @param	{string} what
	 * @returns {boolean}
	 */
	isDirectory (what) {
		return (what.charAt(what.length-1) === "/");
	}

	/**
	 * Resolve a path against the directory of the Path
	 *
	 * https://nodejs.org/api/path.html#path_path_resolve_paths
	 * @param	{string} what
	 * @returns {string} resolved
	 */
	resolve (what) {
		return path.resolve(this.directory, what);
	}

	/**
	 * Resolve a path relative to the directory of the Path
	 *
	 * https://nodejs.org/api/path.html#path_path_relative_from_to
	 * @param	{string} what
	 * @returns {string} relative
	 */
	relative (what) {
		var isAbsolute = what && (what.indexOf("://") > -1);

		if (isAbsolute) {
			return what;
		}

		return path.relative(this.directory, what);
	}

	splitPath(filename) {
		return this.splitPathRe.exec(filename).slice(1);
	}

	/**
	 * Return the path string
	 * @returns {string} path
	 */
	toString () {
		return this.path;
	}
}

export default Path;
