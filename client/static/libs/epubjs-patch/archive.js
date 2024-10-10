import {defer, isXml, parse} from "./utils/core";
import request from "./utils/request";
import mime from "./utils/mime";
import Path from "./utils/path";
import JSZip from "jszip/dist/jszip";

/**
 * Handles Unzipping a requesting files from an Epub Archive
 * @class
 */
class Archive {

	constructor() {
		this.zip = undefined;
		this.urlCache = {};

		this.checkRequirements();

	}

	/**
	 * Checks to see if JSZip exists in global namspace,
	 * Requires JSZip if it isn't there
	 * @private
	 */
	checkRequirements(){
		try {
			this.zip = new JSZip();
		} catch (e) {
			throw new Error("JSZip lib not loaded");
		}
	}

	/**
	 * Open an archive
	 * @param  {binary} input
	 * @param  {boolean} [isBase64] tells JSZip if the input data is base64 encoded
	 * @return {Promise} zipfile
	 */
	open(input, isBase64){
		return this.zip.loadAsync(input, {"base64": isBase64});
	}

	/**
	 * Load and Open an archive
	 * @param  {string} zipUrl
	 * @param  {boolean} [isBase64] tells JSZip if the input data is base64 encoded
	 * @return {Promise} zipfile
	 */
	openUrl(zipUrl, isBase64){
		return request(zipUrl, "binary")
			.then(function(data){
				return this.zip.loadAsync(data, {"base64": isBase64});
			}.bind(this));
	}

	/**
	 * Request a url from the archive
	 * @param  {string} url  a url to request from the archive
	 * @param  {string} [type] specify the type of the returned result
	 * @return {Promise<Blob | string | JSON | Document | XMLDocument>}
	 */
	request(url, type){
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

		if (response) {
			response.then(function (r) {
				let result = this.handleResponse(r, type);
				deferred.resolve(result);
			}.bind(this));
		} else {
			deferred.reject({
				message : "File not found in the epub: " + url,
				stack : new Error().stack
			});
		}
		return deferred.promise;
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
	 * Get a Blob from Archive by Url
	 * @param  {string} url
	 * @param  {string} [mimeType]
	 * @return {Blob}
	 */
	getBlob(url, mimeType){
		var decodededUrl = window.decodeURIComponent(url.substr(1)); // Remove first slash
		var entry = this.zip.file(decodededUrl);

		if(entry) {
			mimeType = mimeType || mime.lookup(entry.name);
			return entry.async("uint8array").then(function(uint8array) {
				return new Blob([uint8array], {type : mimeType});
			});
		}
	}

	/**
	 * Get Text from Archive by Url
	 * @param  {string} url
	 * @param  {string} [encoding]
	 * @return {string}
	 */
	getText(url, encoding){
		var decodededUrl = window.decodeURIComponent(url.substr(1)); // Remove first slash
		var entry = this.zip.file(decodededUrl);

		if(entry) {
			return entry.async("string").then(function(text) {
				return text;
			});
		}
	}

	/**
	 * Get a base64 encoded result from Archive by Url
	 * @param  {string} url
	 * @param  {string} [mimeType]
	 * @return {string} base64 encoded
	 */
	getBase64(url, mimeType){
		var decodededUrl = window.decodeURIComponent(url.substr(1)); // Remove first slash
		var entry = this.zip.file(decodededUrl);

		if(entry) {
			mimeType = mimeType || mime.lookup(entry.name);
			return entry.async("base64").then(function(data) {
				return "data:" + mimeType + ";base64," + data;
			});
		}
	}

	/**
	 * Create a Url from an unarchived item
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
				message : "File not found in the epub: " + url,
				stack : new Error().stack
			});
		}

		return deferred.promise;
	}

	/**
	 * Revoke Temp Url for a archive item
	 * @param  {string} url url of the item in the archive
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
		this.zip = undefined;
		this.urlCache = {};
	}
}

export default Archive;
