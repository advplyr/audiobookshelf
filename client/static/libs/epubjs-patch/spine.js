import EpubCFI from "./epubcfi";
import Hook from "./utils/hook";
import Section from "./section";
import {replaceBase, replaceCanonical, replaceMeta} from "./utils/replacements";

/**
 * A collection of Spine Items
 */
class Spine {
	constructor() {
		this.spineItems = [];
		this.spineByHref = {};
		this.spineById = {};

		this.hooks = {};
		this.hooks.serialize = new Hook();
		this.hooks.content = new Hook();

		// Register replacements
		this.hooks.content.register(replaceBase);
		this.hooks.content.register(replaceCanonical);
		this.hooks.content.register(replaceMeta);

		this.epubcfi = new EpubCFI();

		this.loaded = false;

		this.items = undefined;
		this.manifest = undefined;
		this.spineNodeIndex = undefined;
		this.baseUrl = undefined;
		this.length = undefined;
	}

	/**
	 * Unpack items from a opf into spine items
	 * @param  {Packaging} _package
	 * @param  {method} resolver URL resolver
	 * @param  {method} canonical Resolve canonical url
	 */
	unpack(_package, resolver, canonical) {

		this.items = _package.spine;
		this.manifest = _package.manifest;
		this.spineNodeIndex = _package.spineNodeIndex;
		this.baseUrl = _package.baseUrl || _package.basePath || "";
		this.length = this.items.length;

		this.items.forEach( (item, index) => {
			var manifestItem = this.manifest[item.idref];
			var spineItem;

			item.index = index;
			item.cfiBase = this.epubcfi.generateChapterComponent(this.spineNodeIndex, item.index, item.id);

			if (item.href) {
				item.url = resolver(item.href, true);
				item.canonical = canonical(item.href);
			}

			if(manifestItem) {
				item.href = manifestItem.href;
				item.url = resolver(item.href, true);
				item.canonical = canonical(item.href);

				if(manifestItem.properties.length){
					item.properties.push.apply(item.properties, manifestItem.properties);
				}
			}

			if (item.linear === "yes") {
				item.prev = function() {
					let prevIndex = item.index;
					while (prevIndex > 0) {
						let prev = this.get(prevIndex-1);
						if (prev && prev.linear) {
							return prev;
						}
						prevIndex -= 1;
					}
					return;
				}.bind(this);
				item.next = function() {
					let nextIndex = item.index;
					while (nextIndex < this.spineItems.length-1) {
						let next = this.get(nextIndex+1);
						if (next && next.linear) {
							return next;
						}
						nextIndex += 1;
					}
					return;
				}.bind(this);
			} else {
				item.prev = function() {
					return;
				}
				item.next = function() {
					return;
				}
			}


			spineItem = new Section(item, this.hooks);

			this.append(spineItem);


		});

		this.loaded = true;
	}

	/**
	 * Get an item from the spine
	 * @param  {string|number} [target]
	 * @return {Section} section
	 * @example spine.get();
	 * @example spine.get(1);
	 * @example spine.get("chap1.html");
	 * @example spine.get("#id1234");
	 */
	get(target) {
		var index = 0;

		if (typeof target === "undefined") {
			while (index < this.spineItems.length) {
				let next = this.spineItems[index];
				if (next && next.linear) {
					break;
				}
				index += 1;
			}
		} else if(this.epubcfi.isCfiString(target)) {
			let cfi = new EpubCFI(target);
			index = cfi.spinePos;
		} else if(typeof target === "number" || isNaN(target) === false){
			index = target;
		} else if(typeof target === "string" && target.indexOf("#") === 0) {
			index = this.spineById[target.substring(1)];
		} else if(typeof target === "string") {
			// Remove fragments
			target = target.split("#")[0];
			index = this.spineByHref[target] || this.spineByHref[encodeURI(target)];
		}

		return this.spineItems[index] || null;
	}

	/**
	 * Append a Section to the Spine
	 * @private
	 * @param  {Section} section
	 */
	append(section) {
		var index = this.spineItems.length;
		section.index = index;

		this.spineItems.push(section);

		// Encode and Decode href lookups
		// see pr for details: https://github.com/futurepress/epub.js/pull/358
		this.spineByHref[decodeURI(section.href)] = index;
		this.spineByHref[encodeURI(section.href)] = index;
		this.spineByHref[section.href] = index;

		this.spineById[section.idref] = index;

		return index;
	}

	/**
	 * Prepend a Section to the Spine
	 * @private
	 * @param  {Section} section
	 */
	prepend(section) {
		// var index = this.spineItems.unshift(section);
		this.spineByHref[section.href] = 0;
		this.spineById[section.idref] = 0;

		// Re-index
		this.spineItems.forEach(function(item, index){
			item.index = index;
		});

		return 0;
	}

	// insert(section, index) {
	//
	// };

	/**
	 * Remove a Section from the Spine
	 * @private
	 * @param  {Section} section
	 */
	remove(section) {
		var index = this.spineItems.indexOf(section);

		if(index > -1) {
			delete this.spineByHref[section.href];
			delete this.spineById[section.idref];

			return this.spineItems.splice(index, 1);
		}
	}

	/**
	 * Loop over the Sections in the Spine
	 * @return {method} forEach
	 */
	each() {
		return this.spineItems.forEach.apply(this.spineItems, arguments);
	}

	/**
	 * Find the first Section in the Spine
	 * @return {Section} first section
	 */
	first() {
		let index = 0;

		do {
			let next = this.get(index);

			if (next && next.linear) {
				return next;
			}
			index += 1;
		} while (index < this.spineItems.length) ;
	}

	/**
	 * Find the last Section in the Spine
	 * @return {Section} last section
	 */
	last() {
		let index = this.spineItems.length-1;

		do {
			let prev = this.get(index);
			if (prev && prev.linear) {
				return prev;
			}
			index -= 1;
		} while (index >= 0);
	}

	destroy() {
		this.each((section) => section.destroy());

		this.spineItems = undefined
		this.spineByHref = undefined
		this.spineById = undefined

		this.hooks.serialize.clear();
		this.hooks.content.clear();
		this.hooks = undefined;

		this.epubcfi = undefined;

		this.loaded = false;

		this.items = undefined;
		this.manifest = undefined;
		this.spineNodeIndex = undefined;
		this.baseUrl = undefined;
		this.length = undefined;
	}
}

export default Spine;
