import {qs, qsa, querySelectorByType, filterChildren, getParentByTagName} from "./utils/core";

/**
 * Navigation Parser
 * @param {document} xml navigation html / xhtml / ncx
 */
class Navigation {
	constructor(xml) {
		this.toc = [];
		this.tocByHref = {};
		this.tocById = {};

		this.landmarks = [];
		this.landmarksByType = {};

		this.length = 0;
		if (xml) {
			this.parse(xml);
		}
	}

	/**
	 * Parse out the navigation items
	 * @param {document} xml navigation html / xhtml / ncx
	 */
	parse(xml) {
		let isXml = xml.nodeType;
		let html;
		let ncx;

		if (isXml) {
			html = qs(xml, "html");
			ncx = qs(xml, "ncx");
		}

		if (!isXml) {
			this.toc = this.load(xml);
		} else if(html) {
			this.toc = this.parseNav(xml);
			this.landmarks = this.parseLandmarks(xml);
		} else if(ncx){
			this.toc = this.parseNcx(xml);
		}

		this.length = 0;

		this.unpack(this.toc);
	}

	/**
	 * Unpack navigation items
	 * @private
	 * @param  {array} toc
	 */
	unpack(toc) {
		var item;

		for (var i = 0; i < toc.length; i++) {
			item = toc[i];

			if (item.href) {
				this.tocByHref[item.href] = i;
			}

			if (item.id) {
				this.tocById[item.id] = i;
			}

			this.length++;

			if (item.subitems.length) {
				this.unpack(item.subitems);
			}
		}

	}

	/**
	 * Get an item from the navigation
	 * @param  {string} target
	 * @return {object} navItem
	 */
	get(target) {
		var index;

		if(!target) {
			return this.toc;
		}

		if(target.indexOf("#") === 0) {
			index = this.tocById[target.substring(1)];
		} else if(target in this.tocByHref){
			index = this.tocByHref[target];
		}

		return this.getByIndex(target, index, this.toc);
	}

	/**
	 * Get an item from navigation subitems recursively by index
	 * @param  {string} target
	 * @param  {number} index
	 * @param  {array} navItems
	 * @return {object} navItem
	 */
	getByIndex(target, index, navItems) {
		if (navItems.length === 0) {
			return;
		}

		const item = navItems[index];
		if (item && (target === item.id || target === item.href)) {
			return item;
		} else {
			let result;
			for (let i = 0; i < navItems.length; ++i) {
				result = this.getByIndex(target, index, navItems[i].subitems);
				if (result) {
					break;
				}
			}
			return result;
		}
	}

	/**
	 * Get a landmark by type
	 * List of types: https://idpf.github.io/epub-vocabs/structure/
	 * @param  {string} type
	 * @return {object} landmarkItem
	 */
	landmark(type) {
		var index;

		if(!type) {
			return this.landmarks;
		}

		index = this.landmarksByType[type];

		return this.landmarks[index];
	}

	/**
	 * Parse toc from a Epub > 3.0 Nav
	 * @private
	 * @param  {document} navHtml
	 * @return {array} navigation list
	 */
	parseNav(navHtml){
		var navElement = querySelectorByType(navHtml, "nav", "toc");
		var list = [];

		if (!navElement) return list;

		let navList = filterChildren(navElement, "ol", true);
		if (!navList) return list;

		list = this.parseNavList(navList);
		return list;
	}

	/**
	 * Parses lists in the toc
	 * @param  {document} navListHtml
	 * @param  {string} parent id
	 * @return {array} navigation list
	 */
	parseNavList(navListHtml, parent) {
		const result = [];

		if (!navListHtml) return result;
		if (!navListHtml.children) return result;
		
		for (let i = 0; i < navListHtml.children.length; i++) {
			const item = this.navItem(navListHtml.children[i], parent);

			if (item) {
				result.push(item);
			}
		}

		return result;
	}

	/**
	 * Create a navItem
	 * @private
	 * @param  {element} item
	 * @return {object} navItem
	 */
	navItem(item, parent) {
		let id = item.getAttribute("id") || undefined;
		let content = filterChildren(item, "a", true)
			|| filterChildren(item, "span", true);

		if (!content) {
			return;
		}

		let src = content.getAttribute("href") || "";
		
		if (!id) {
			id = src;
		}
		let text = content.textContent || "";

		let subitems = [];
		let nested = filterChildren(item, "ol", true);
		if (nested) {
			subitems = 	this.parseNavList(nested, id);
		}

		return {
			"id": id,
			"href": src,
			"label": text,
			"subitems" : subitems,
			"parent" : parent
		};
	}

	/**
	 * Parse landmarks from a Epub > 3.0 Nav
	 * @private
	 * @param  {document} navHtml
	 * @return {array} landmarks list
	 */
	parseLandmarks(navHtml){
		var navElement = querySelectorByType(navHtml, "nav", "landmarks");
		var navItems = navElement ? qsa(navElement, "li") : [];
		var length = navItems.length;
		var i;
		var list = [];
		var item;

		if(!navItems || length === 0) return list;

		for (i = 0; i < length; ++i) {
			item = this.landmarkItem(navItems[i]);
			if (item) {
				list.push(item);
				this.landmarksByType[item.type] = i;
			}
		}

		return list;
	}

	/**
	 * Create a landmarkItem
	 * @private
	 * @param  {element} item
	 * @return {object} landmarkItem
	 */
	landmarkItem(item){
		let content = filterChildren(item, "a", true);

		if (!content) {
			return;
		}

		let type = content.getAttributeNS("http://www.idpf.org/2007/ops", "type") || undefined;
		let href = content.getAttribute("href") || "";
		let text = content.textContent || "";

		return {
			"href": href,
			"label": text,
			"type" : type
		};
	}

	/**
	 * Parse from a Epub > 3.0 NC
	 * @private
	 * @param  {document} navHtml
	 * @return {array} navigation list
	 */
	parseNcx(tocXml){
		var navPoints = qsa(tocXml, "navPoint");
		var length = navPoints.length;
		var i;
		var toc = {};
		var list = [];
		var item, parent;

		if(!navPoints || length === 0) return list;

		for (i = 0; i < length; ++i) {
			item = this.ncxItem(navPoints[i]);
			toc[item.id] = item;
			if(!item.parent) {
				list.push(item);
			} else {
				parent = toc[item.parent];
				parent.subitems.push(item);
			}
		}

		return list;
	}

	/**
	 * Create a ncxItem
	 * @private
	 * @param  {element} item
	 * @return {object} ncxItem
	 */
	ncxItem(item){
		var id = item.getAttribute("id") || false,
				content = qs(item, "content"),
				src = content.getAttribute("src"),
				navLabel = qs(item, "navLabel"),
				text = navLabel.textContent ? navLabel.textContent : "",
				subitems = [],
				parentNode = item.parentNode,
				parent;

		if(parentNode && (parentNode.nodeName === "navPoint" || parentNode.nodeName.split(':').slice(-1)[0] === "navPoint")) {
			parent = parentNode.getAttribute("id");
		}


		return {
			"id": id,
			"href": src,
			"label": text,
			"subitems" : subitems,
			"parent" : parent
		};
	}

	/**
	 * Load Spine Items
	 * @param  {object} json the items to be loaded
	 * @return {Array} navItems
	 */
	load(json) {
		return json.map(item => {
			item.label = item.title;
			item.subitems = item.children ? this.load(item.children) : [];
			return item;
		});
	}

	/**
	 * forEach pass through
	 * @param  {Function} fn function to run on each item
	 * @return {method} forEach loop
	 */
	forEach(fn) {
		return this.toc.forEach(fn);
	}
}

export default Navigation;
