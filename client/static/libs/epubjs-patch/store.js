import {defer, isXml, parse} from "./utils/core";
import httpRequest from "./utils/request";
import mime from "./utils/mime";
import Path from "./utils/path";
import { EventEmitter } from "events";
import localforage from "localforage";

/**
 * Handles saving and requesting files from local storage
 * @class
 * @param {string} name This should be the name of the application for modals
 * @param {function} [requester]
 * @param {function} [resolver]
 */
class Store extends EventEmitter {

	constructor(name, requester, resolver) {
		super();
		this.urlCache = {};

		this.storage = undefined;

		this.name = name;
		this.requester = requester || httpRequest;
		this.resolver = resolver;

		this.online = true;

		this.checkRequirements();

		this.addListeners();
	}

	/**
	 * Checks to see if localForage exists in global namspace,
	 * Requires localForage if it isn't there
	 * @private
	 */
	checkRequirements(){
		try {
			let store;
			if (typeof localforage === "undefined") {
				store = localforage;
			}
			this.storage = store.createInstance({
					name: this.name
			});
		} catch (e) {
			throw new Error("localForage lib not loaded");
		}
	}

	/**
	 * Add online and offline event listeners
	 * @private
	 */
	addListeners() {
		this._status = this.status.bind(this);
		window.addEventListener('online',  this._status);
	  window.addEventListener('offline', this._status);
	}

	/**
	 * Remove online and offline event listeners
	 * @private
	 */
	removeListeners() {
		window.removeEventListener('online',  this._status);
	  window.removeEventListener('offline', this._status);
		this._status = undefined;
	}

	/**
	 * Update the online / offline status
	 * @private
	 */
	status(event) {
		let online = navigator.onLine;
		this.online = online;
		if (online) {
			this.emit("online", this);
		} else {
			this.emit("offline", this);
		}
	}

	/**
	 * Add all of a book resources to the store
	 * @param  {Resources} resources  book resources
	 * @param  {boolean} [force] force resaving resources
	 * @return {Promise<object>} store objects
	 */
	add(resources, force) {
		let mapped = resources.resources.map((item) => {
			let { href } = item;
			let url = this.resolver(href);
			let encodedUrl = window.encodeURIComponent(url);

			return this.storage.getItem(encodedUrl).then((item) => {
				if (!item || force) {
					return this.requester(url, "binary")
						.then((data) => {
							return this.storage.setItem(encodedUrl, data);
						});
				} else {
					return item;
				}
			});

		});
		return Promise.all(mapped);
	}

	/**
	 * Put binary data from a url to storage
	 * @param  {string} url  a url to request from storage
	 * @param  {boolean} [withCredentials]
	 * @param  {object} [headers]
	 * @return {Promise<Blob>}
	 */
	put(url, withCredentials, headers) {
		let encodedUrl = window.encodeURIComponent(url);

		return this.storage.getItem(encodedUrl).then((result) => {
			if (!result) {
				return this.requester(url, "binary", withCredentials, headers).then((data) => {
					return this.storage.setItem(encodedUrl, data);
				});
			}
			return result;
		});
	}

	/**
	 * Request a url
	 * @param  {string} url  a url to request from storage
	 * @param  {string} [type] specify the type of the returned result
	 * @param  {boolean} [withCredentials]
	 * @param  {object} [headers]
	 * @return {Promise<Blob | string | JSON | Document | XMLDocument>}
	 */
	request(url, type, withCredentials, headers){
		if (this.online) {
			// From network
			return this.requester(url, type, withCredentials, headers).then((data) => {
				// save to store if not present
				this.put(url);
				return data;
			})
		} else {
			// From store
			return this.retrieve(url, type);
		}

	}

	/**
	 * Request a url from storage
	 * @param  {string} url  a url to request from storage
	 * @param  {string} [type] specify the type of the returned result
	 * @return {Promise<Blob | string | JSON | Document | XMLDocument>}
	 */
	retrieve(url, type) {
		var deferred = new defer();
		var response;
		var path = new Path(url);

		// If type isn't set, determine it from the file extension
		if(!type) {
			type = path.extension;
		}

		if(type == "blob"){
			response = this.getBlob(url);
		} else {
			response = this.getText(url);
		}


		return response.then((r) => {
			var deferred = new defer();
			var result;
			if (r) {
				result = this.handleResponse(r, type);
				deferred.resolve(result);
			} else {
				deferred.reject({
					message : "File not found in storage: " + url,
					stack : new Error().stack
				});
			}
			return deferred.promise;
		});
	}

	/**
	 * Handle the response from request
	 * @private
	 * @param  {any} response
	 * @param  {string} [type]
	 * @return {any} the parsed result
	 */
	handleResponse(response, type){
		var r;

		if(type == "json") {
			r = JSON.parse(response);
		}
		else
		if(isXml(type)) {
			r = parse(response, "text/xml");
		}
		else
		if(type == "xhtml") {
			r = parse(response, "application/xhtml+xml");
		}
		else
		if(type == "html" || type == "htm") {
			r = parse(response, "text/html");
		 } else {
			 r = response;
		 }

		return r;
	}

	/**
	 * Get a Blob from Storage by Url
	 * @param  {string} url
	 * @param  {string} [mimeType]
	 * @return {Blob}
	 */
	getBlob(url, mimeType){
		let encodedUrl = window.encodeURIComponent(url);

		return this.storage.getItem(encodedUrl).then(function(uint8array) {
			if(!uint8array) return;

			mimeType = mimeType || mime.lookup(url);

			return new Blob([uint8array], {type : mimeType});
		});

	}

	/**
	 * Get Text from Storage by Url
	 * @param  {string} url
	 * @param  {string} [mimeType]
	 * @return {string}
	 */
	getText(url, mimeType){
		let encodedUrl = window.encodeURIComponent(url);

		mimeType = mimeType || mime.lookup(url);

		return this.storage.getItem(encodedUrl).then(function(uint8array) {
			var deferred = new defer();
			var reader = new FileReader();
			var blob;

			if(!uint8array) return;

			blob = new Blob([uint8array], {type : mimeType});

			reader.addEventListener("loadend", () => {
				deferred.resolve(reader.result);
			});

			reader.readAsText(blob, mimeType);

			return deferred.promise;
		});
	}

	/**
	 * Get a base64 encoded result from Storage by Url
	 * @param  {string} url
	 * @param  {string} [mimeType]
	 * @return {string} base64 encoded
	 */
	getBase64(url, mimeType){
		let encodedUrl = window.encodeURIComponent(url);

		mimeType = mimeType || mime.lookup(url);

		return this.storage.getItem(encodedUrl).then((uint8array) => {
			var deferred = new defer();
			var reader = new FileReader();
			var blob;

			if(!uint8array) return;

			blob = new Blob([uint8array], {type : mimeType});

			reader.addEventListener("loadend", () => {
				deferred.resolve(reader.result);
			});
			reader.readAsDataURL(blob, mimeType);

			return deferred.promise;
		});
	}

	/**
	 * Create a Url from a stored item
	 * @param  {string} url
	 * @param  {object} [options.base64] use base64 encoding or blob url
	 * @return {Promise} url promise with Url string
	 */
	createUrl(url, options){
		var deferred = new defer();
		var _URL = window.URL || window.webkitURL || window.mozURL;
		var tempUrl;
		var response;
		var useBase64 = options && options.base64;

		if(url in this.urlCache) {
			deferred.resolve(this.urlCache[url]);
			return deferred.promise;
		}

		if (useBase64) {
			response = this.getBase64(url);

			if (response) {
				response.then(function(tempUrl) {

					this.urlCache[url] = tempUrl;
					deferred.resolve(tempUrl);

				}.bind(this));

			}

		} else {

			response = this.getBlob(url);

			if (response) {
				response.then(function(blob) {

					tempUrl = _URL.createObjectURL(blob);
					this.urlCache[url] = tempUrl;
					deferred.resolve(tempUrl);

				}.bind(this));

			}
		}


		if (!response) {
			deferred.reject({
				message : "File not found in storage: " + url,
				stack : new Error().stack
			});
		}

		return deferred.promise;
	}

	/**
	 * Revoke Temp Url for a archive item
	 * @param  {string} url url of the item in the store
	 */
	revokeUrl(url){
		var _URL = window.URL || window.webkitURL || window.mozURL;
		var fromCache = this.urlCache[url];
		if(fromCache) _URL.revokeObjectURL(fromCache);
	}

	destroy() {
		var _URL = window.URL || window.webkitURL || window.mozURL;
		for (let fromCache in this.urlCache) {
			_URL.revokeObjectURL(fromCache);
		}
		this.urlCache = {};
		this.removeListeners();
	}
}

Object.assign(Store.prototype, EventEmitter.prototype);

export default Store;
