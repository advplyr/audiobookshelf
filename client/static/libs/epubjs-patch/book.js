import { EventEmitter } from "events";
import {extend, defer} from "./utils/core";
import Url from "./utils/url";
import Path from "./utils/path";
import Spine from "./spine";
import Locations from "./locations";
import Container from "./container";
import Packaging from "./packaging";
import Navigation from "./navigation";
import Resources from "./resources";
import PageList from "./pagelist";
import Rendition from "./rendition";
import Archive from "./archive";
import request from "./utils/request";
import EpubCFI from "./epubcfi";
import Store from "./store";
import DisplayOptions from "./displayoptions";
import { EPUBJS_VERSION, EVENTS } from "./utils/constants";

const CONTAINER_PATH = "META-INF/container.xml";
const IBOOKS_DISPLAY_OPTIONS_PATH = "META-INF/com.apple.ibooks.display-options.xml";

const INPUT_TYPE = {
	BINARY: "binary",
	BASE64: "base64",
	EPUB: "epub",
	OPF: "opf",
	MANIFEST: "json",
	DIRECTORY: "directory"
};

/**
 * An Epub representation with methods for the loading, parsing and manipulation
 * of its contents.
 * @class
 * @param {string} [url]
 * @param {object} [options]
 * @param {method} [options.requestMethod] a request function to use instead of the default
 * @param {boolean} [options.requestCredentials=undefined] send the xhr request withCredentials
 * @param {object} [options.requestHeaders=undefined] send the xhr request headers
 * @param {string} [options.encoding=binary] optional to pass 'binary' or base64' for archived Epubs
 * @param {string} [options.replacements=none] use base64, blobUrl, or none for replacing assets in archived Epubs
 * @param {method} [options.canonical] optional function to determine canonical urls for a path
 * @param {string} [options.openAs] optional string to determine the input type
 * @param {string} [options.store=false] cache the contents in local storage, value should be the name of the reader
 * @returns {Book}
 * @example new Book("/path/to/book.epub", {})
 * @example new Book({ replacements: "blobUrl" })
 */
class Book extends EventEmitter {
	constructor(url, options) {
		super();
		// Allow passing just options to the Book
		if (typeof(options) === "undefined" &&
			  typeof(url) !== "string" &&
		    url instanceof Blob === false &&
		    url instanceof ArrayBuffer === false) {
			options = url;
			url = undefined;
		}

		this.settings = extend(this.settings || {}, {
			requestMethod: undefined,
			requestCredentials: undefined,
			requestHeaders: undefined,
			encoding: undefined,
			replacements: undefined,
			canonical: undefined,
			openAs: undefined,
			store: undefined
		});

		extend(this.settings, options);


		// Promises
		this.opening = new defer();
		/**
		 * @member {promise} opened returns after the book is loaded
		 * @memberof Book
		 */
		this.opened = this.opening.promise;
		this.isOpen = false;

		this.loading = {
			manifest: new defer(),
			spine: new defer(),
			metadata: new defer(),
			cover: new defer(),
			navigation: new defer(),
			pageList: new defer(),
			resources: new defer(),
			displayOptions: new defer()
		};

		this.loaded = {
			manifest: this.loading.manifest.promise,
			spine: this.loading.spine.promise,
			metadata: this.loading.metadata.promise,
			cover: this.loading.cover.promise,
			navigation: this.loading.navigation.promise,
			pageList: this.loading.pageList.promise,
			resources: this.loading.resources.promise,
			displayOptions: this.loading.displayOptions.promise
		};

		/**
		 * @member {promise} ready returns after the book is loaded and parsed
		 * @memberof Book
		 * @private
		 */
		this.ready = Promise.all([
			this.loaded.manifest,
			this.loaded.spine,
			this.loaded.metadata,
			this.loaded.cover,
			this.loaded.navigation,
			this.loaded.resources,
			this.loaded.displayOptions
		]);


		// Queue for methods used before opening
		this.isRendered = false;
		// this._q = queue(this);

		/**
		 * @member {method} request
		 * @memberof Book
		 * @private
		 */
		this.request = this.settings.requestMethod || request;

		/**
		 * @member {Spine} spine
		 * @memberof Book
		 */
		this.spine = new Spine();

		/**
		 * @member {Locations} locations
		 * @memberof Book
		 */
		this.locations = new Locations(this.spine, this.load.bind(this));

		/**
		 * @member {Navigation} navigation
		 * @memberof Book
		 */
		this.navigation = undefined;

		/**
		 * @member {PageList} pagelist
		 * @memberof Book
		 */
		this.pageList = undefined;

		/**
		 * @member {Url} url
		 * @memberof Book
		 * @private
		 */
		this.url = undefined;

		/**
		 * @member {Path} path
		 * @memberof Book
		 * @private
		 */
		this.path = undefined;

		/**
		 * @member {boolean} archived
		 * @memberof Book
		 * @private
		 */
		this.archived = false;

		/**
		 * @member {Archive} archive
		 * @memberof Book
		 * @private
		 */
		this.archive = undefined;

		/**
		 * @member {Store} storage
		 * @memberof Book
		 * @private
		 */
		this.storage = undefined;

		/**
		 * @member {Resources} resources
		 * @memberof Book
		 * @private
		 */
		this.resources = undefined;

		/**
		 * @member {Rendition} rendition
		 * @memberof Book
		 * @private
		 */
		this.rendition = undefined;

		/**
		 * @member {Container} container
		 * @memberof Book
		 * @private
		 */
		this.container = undefined;

		/**
		 * @member {Packaging} packaging
		 * @memberof Book
		 * @private
		 */
		this.packaging = undefined;

		/**
		 * @member {DisplayOptions} displayOptions
		 * @memberof DisplayOptions
		 * @private
		 */
		this.displayOptions = undefined;

		// this.toc = undefined;
		if (this.settings.store) {
			this.store(this.settings.store);
		}

		if(url) {
			this.open(url, this.settings.openAs).catch((error) => {
				var err = new Error("Cannot load book at "+ url );
				this.emit(EVENTS.BOOK.OPEN_FAILED, err);
			});
		}
	}

	/**
	 * Open a epub or url
	 * @param {string | ArrayBuffer} input Url, Path or ArrayBuffer
	 * @param {string} [what="binary", "base64", "epub", "opf", "json", "directory"] force opening as a certain type
	 * @returns {Promise} of when the book has been loaded
	 * @example book.open("/path/to/book.epub")
	 */
	open(input, what) {
		var opening;
		var type = what || this.determineType(input);

		if (type === INPUT_TYPE.BINARY) {
			this.archived = true;
			this.url = new Url("/", "");
			opening = this.openEpub(input);
		} else if (type === INPUT_TYPE.BASE64) {
			this.archived = true;
			this.url = new Url("/", "");
			opening = this.openEpub(input, type);
		} else if (type === INPUT_TYPE.EPUB) {
			this.archived = true;
			this.url = new Url("/", "");
			opening = this.request(input, "binary", this.settings.requestCredentials, this.settings.requestHeaders)
				.then(this.openEpub.bind(this));
		} else if(type == INPUT_TYPE.OPF) {
			this.url = new Url(input);
			opening = this.openPackaging(this.url.Path.toString());
		} else if(type == INPUT_TYPE.MANIFEST) {
			this.url = new Url(input);
			opening = this.openManifest(this.url.Path.toString());
		} else {
			this.url = new Url(input);
			opening = this.openContainer(CONTAINER_PATH)
				.then(this.openPackaging.bind(this));
		}

		return opening;
	}

	/**
	 * Open an archived epub
	 * @private
	 * @param  {binary} data
	 * @param  {string} [encoding]
	 * @return {Promise}
	 */
	openEpub(data, encoding) {
		return this.unarchive(data, encoding || this.settings.encoding)
			.then(() => {
				return this.openContainer(CONTAINER_PATH);
			})
			.then((packagePath) => {
				return this.openPackaging(packagePath);
			});
	}

	/**
	 * Open the epub container
	 * @private
	 * @param  {string} url
	 * @return {string} packagePath
	 */
	openContainer(url) {
		return this.load(url)
			.then((xml) => {
				this.container = new Container(xml);
				return this.resolve(this.container.packagePath);
			});
	}

	/**
	 * Open the Open Packaging Format Xml
	 * @private
	 * @param  {string} url
	 * @return {Promise}
	 */
	openPackaging(url) {
		this.path = new Path(url);
		return this.load(url)
			.then((xml) => {
				this.packaging = new Packaging(xml);
				return this.unpack(this.packaging);
			});
	}

	/**
	 * Open the manifest JSON
	 * @private
	 * @param  {string} url
	 * @return {Promise}
	 */
	openManifest(url) {
		this.path = new Path(url);
		return this.load(url)
			.then((json) => {
				this.packaging = new Packaging();
				this.packaging.load(json);
				return this.unpack(this.packaging);
			});
	}

	/**
	 * Load a resource from the Book
	 * @param  {string} path path to the resource to load
	 * @return {Promise}     returns a promise with the requested resource
	 */
	load(path) {
		var resolved = this.resolve(path);
		if(this.archived) {
			return this.archive.request(resolved);
		} else {
			return this.request(resolved, null, this.settings.requestCredentials, this.settings.requestHeaders);
		}
	}

	/**
	 * Resolve a path to it's absolute position in the Book
	 * @param  {string} path
	 * @param  {boolean} [absolute] force resolving the full URL
	 * @return {string}          the resolved path string
	 */
	resolve(path, absolute) {
		if (!path) {
			return;
		}
		var resolved = path;
		var isAbsolute = (path.indexOf("://") > -1);

		if (isAbsolute) {
			return path;
		}

		if (this.path) {
			resolved = this.path.resolve(path);
		}

		if(absolute != false && this.url) {
			resolved = this.url.resolve(resolved);
		}

		return resolved;
	}

	/**
	 * Get a canonical link to a path
	 * @param  {string} path
	 * @return {string} the canonical path string
	 */
	canonical(path) {
		var url = path;

		if (!path) {
			return "";
		}

		if (this.settings.canonical) {
			url = this.settings.canonical(path);
		} else {
			url = this.resolve(path, true);
		}

		return url;
	}

	/**
	 * Determine the type of they input passed to open
	 * @private
	 * @param  {string} input
	 * @return {string}  binary | directory | epub | opf
	 */
	determineType(input) {
		var url;
		var path;
		var extension;

		if (this.settings.encoding === "base64") {
			return INPUT_TYPE.BASE64;
		}

		if(typeof(input) != "string") {
			return INPUT_TYPE.BINARY;
		}

		url = new Url(input);
		path = url.path();
		extension = path.extension;

		// If there's a search string, remove it before determining type
		if (extension) {
			extension = extension.replace(/\?.*$/, "");
		}

		if (!extension) {
			return INPUT_TYPE.DIRECTORY;
		}

		if(extension === "epub"){
			return INPUT_TYPE.EPUB;
		}

		if(extension === "opf"){
			return INPUT_TYPE.OPF;
		}

		if(extension === "json"){
			return INPUT_TYPE.MANIFEST;
		}
	}


	/**
	 * unpack the contents of the Books packaging
	 * @private
	 * @param {Packaging} packaging object
	 */
	unpack(packaging) {
		this.package = packaging; //TODO: deprecated this

		if (this.packaging.metadata.layout === "") {
			// rendition:layout not set - check display options if book is pre-paginated
			this.load(this.url.resolve(IBOOKS_DISPLAY_OPTIONS_PATH)).then((xml) => {
				this.displayOptions = new DisplayOptions(xml);
				this.loading.displayOptions.resolve(this.displayOptions);
			}).catch((err) => {
				this.displayOptions = new DisplayOptions();
				this.loading.displayOptions.resolve(this.displayOptions);
			});
		} else {
			this.displayOptions = new DisplayOptions();
			this.loading.displayOptions.resolve(this.displayOptions);
		}

		this.spine.unpack(this.packaging, this.resolve.bind(this), this.canonical.bind(this));

		this.resources = new Resources(this.packaging.manifest, {
			archive: this.archive,
			resolver: this.resolve.bind(this),
			request: this.request.bind(this),
			replacements: this.settings.replacements || (this.archived ? "blobUrl" : "base64")
		});

		this.loadNavigation(this.packaging).then(() => {
			// this.toc = this.navigation.toc;
			this.loading.navigation.resolve(this.navigation);
		});

		if (this.packaging.coverPath) {
			this.cover = this.resolve(this.packaging.coverPath);
		}
		// Resolve promises
		this.loading.manifest.resolve(this.packaging.manifest);
		this.loading.metadata.resolve(this.packaging.metadata);
		this.loading.spine.resolve(this.spine);
		this.loading.cover.resolve(this.cover);
		this.loading.resources.resolve(this.resources);
		this.loading.pageList.resolve(this.pageList);

		this.isOpen = true;

		if(this.archived || this.settings.replacements && this.settings.replacements != "none") {
			this.replacements().then(() => {
				this.loaded.displayOptions.then(() => {
					this.opening.resolve(this);
				});
			})
			.catch((err) => {
				console.error(err);
			});
		} else {
			// Resolve book opened promise
			this.loaded.displayOptions.then(() => {
				this.opening.resolve(this);
			});
		}

	}

	/**
	 * Load Navigation and PageList from package
	 * @private
	 * @param {Packaging} packaging
	 */
	loadNavigation(packaging) {
		let navPath = packaging.navPath || packaging.ncxPath;
		let toc = packaging.toc;

		// From json manifest
		if (toc) {
			return new Promise((resolve, reject) => {
				this.navigation = new Navigation(toc);

				if (packaging.pageList) {
					this.pageList = new PageList(packaging.pageList); // TODO: handle page lists from Manifest
				}

				resolve(this.navigation);
			});
		}

		if (!navPath) {
			return new Promise((resolve, reject) => {
				this.navigation = new Navigation();
				this.pageList = new PageList();

				resolve(this.navigation);
			});
		}

		return this.load(navPath, "xml")
			.then((xml) => {
				this.navigation = new Navigation(xml);
				this.pageList = new PageList(xml);
				return this.navigation;
			});
	}

	/**
	 * Gets a Section of the Book from the Spine
	 * Alias for `book.spine.get`
	 * @param {string} target
	 * @return {Section}
	 */
	section(target) {
		return this.spine.get(target);
	}

	/**
	 * Sugar to render a book to an element
	 * @param  {element | string} element element or string to add a rendition to
	 * @param  {object} [options]
	 * @return {Rendition}
	 */
	renderTo(element, options) {
		this.rendition = new Rendition(this, options);
		this.rendition.attachTo(element);

		return this.rendition;
	}

	/**
	 * Set if request should use withCredentials
	 * @param {boolean} credentials
	 */
	setRequestCredentials(credentials) {
		this.settings.requestCredentials = credentials;
	}

	/**
	 * Set headers request should use
	 * @param {object} headers
	 */
	setRequestHeaders(headers) {
		this.settings.requestHeaders = headers;
	}

	/**
	 * Unarchive a zipped epub
	 * @private
	 * @param  {binary} input epub data
	 * @param  {string} [encoding]
	 * @return {Archive}
	 */
	unarchive(input, encoding) {
		this.archive = new Archive();
		return this.archive.open(input, encoding);
	}

	/**
	 * Store the epubs contents
	 * @private
	 * @param  {binary} input epub data
	 * @param  {string} [encoding]
	 * @return {Store}
	 */
	store(name) {
		// Use "blobUrl" or "base64" for replacements
		let replacementsSetting = this.settings.replacements && this.settings.replacements !== "none";
		// Save original url
		let originalUrl = this.url;
		// Save original request method
		let requester = this.settings.requestMethod || request.bind(this);
		// Create new Store
		this.storage = new Store(name, requester, this.resolve.bind(this));
		// Replace request method to go through store
		this.request = this.storage.request.bind(this.storage);

		this.opened.then(() => {
			if (this.archived) {
				this.storage.requester = this.archive.request.bind(this.archive);
			}
			// Substitute hook
			let substituteResources = (output, section) => {
				section.output = this.resources.substitute(output, section.url);
			};

			// Set to use replacements
			this.resources.settings.replacements = replacementsSetting || "blobUrl";
			// Create replacement urls
			this.resources.replacements().
				then(() => {
					return this.resources.replaceCss();
				});

			this.storage.on("offline", () => {
				// Remove url to use relative resolving for hrefs
				this.url = new Url("/", "");
				// Add hook to replace resources in contents
				this.spine.hooks.serialize.register(substituteResources);
			});

			this.storage.on("online", () => {
				// Restore original url
				this.url = originalUrl;
				// Remove hook
				this.spine.hooks.serialize.deregister(substituteResources);
			});

		});

		return this.storage;
	}

	/**
	 * Get the cover url
	 * @return {Promise<?string>} coverUrl
	 */
	coverUrl() {
		return this.loaded.cover.then(() => {
			if (!this.cover) {
				return null;
			}

			if (this.archived) {
				return this.archive.createUrl(this.cover);
			} else {
				return this.cover;
			}
		});
	}

	/**
	 * Load replacement urls
	 * @private
	 * @return {Promise} completed loading urls
	 */
	replacements() {
		this.spine.hooks.serialize.register((output, section) => {
			section.output = this.resources.substitute(output, section.url);
		});

		return this.resources.replacements().
			then(() => {
				return this.resources.replaceCss();
			});
	}

	/**
	 * Find a DOM Range for a given CFI Range
	 * @param  {EpubCFI} cfiRange a epub cfi range
	 * @return {Promise}
	 */
	getRange(cfiRange) {
		var cfi = new EpubCFI(cfiRange);
		var item = this.spine.get(cfi.spinePos);
		var _request = this.load.bind(this);
		if (!item) {
			return new Promise((resolve, reject) => {
				reject("CFI could not be found");
			});
		}
		return item.load(_request).then(function (contents) {
			var range = cfi.toRange(item.document);
			return range;
		});
	}

	/**
	 * Generates the Book Key using the identifier in the manifest or other string provided
	 * @param  {string} [identifier] to use instead of metadata identifier
	 * @return {string} key
	 */
	key(identifier) {
		var ident = identifier || this.packaging.metadata.identifier || this.url.filename;
		return `epubjs:${EPUBJS_VERSION}:${ident}`;
	}

	/**
	 * Destroy the Book and all associated objects
	 */
	destroy() {
		this.opened = undefined;
		this.loading = undefined;
		this.loaded = undefined;
		this.ready = undefined;

		this.isOpen = false;
		this.isRendered = false;

		this.spine && this.spine.destroy();
		this.locations && this.locations.destroy();
		this.pageList && this.pageList.destroy();
		this.archive && this.archive.destroy();
		this.resources && this.resources.destroy();
		this.container && this.container.destroy();
		this.packaging && this.packaging.destroy();
		this.rendition && this.rendition.destroy();
		this.displayOptions && this.displayOptions.destroy();

		this.spine = undefined;
		this.locations = undefined;
		this.pageList = undefined;
		this.archive = undefined;
		this.resources = undefined;
		this.container = undefined;
		this.packaging = undefined;
		this.rendition = undefined;

		this.navigation = undefined;
		this.url = undefined;
		this.path = undefined;
		this.archived = false;
	}

}

//-- Enable binding events to book
Object.assign(Book.prototype, EventEmitter.prototype);

export default Book;
