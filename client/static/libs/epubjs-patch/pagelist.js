import EpubCFI from "./epubcfi";
import {
	qs,
	qsa,
	querySelectorByType,
	indexOfSorted,
	locationOf
} from "./utils/core";

/**
 * Page List Parser
 * @param {document} [xml]
 */
class PageList {
	constructor(xml) {
		this.pages = [];
		this.locations = [];
		this.epubcfi = new EpubCFI();

		this.firstPage = 0;
		this.lastPage = 0;
		this.totalPages = 0;

		this.toc = undefined;
		this.ncx = undefined;

		if (xml) {
			this.pageList = this.parse(xml);
		}

		if(this.pageList && this.pageList.length) {
			this.process(this.pageList);
		}
	}

	/**
	 * Parse PageList Xml
	 * @param  {document} xml
	 */
	parse(xml) {
		var html = qs(xml, "html");
		var ncx = qs(xml, "ncx");

		if(html) {
			return this.parseNav(xml);
		} else if(ncx){
			return this.parseNcx(xml);
		}

	}

	/**
	 * Parse a Nav PageList
	 * @private
	 * @param  {node} navHtml
	 * @return {PageList.item[]} list
	 */
	parseNav(navHtml){
		var navElement = querySelectorByType(navHtml, "nav", "page-list");
		var navItems = navElement ? qsa(navElement, "li") : [];
		var length = navItems.length;
		var i;
		var list = [];
		var item;

		if(!navItems || length === 0) return list;

		for (i = 0; i < length; ++i) {
			item = this.item(navItems[i]);
			list.push(item);
		}

		return list;
	}

	parseNcx(navXml) {
		var list = [];
		var i = 0;
		var item;
		var pageList;
		var pageTargets;
		var length = 0;

		pageList = qs(navXml, "pageList");
		if (!pageList) return list;

		pageTargets = qsa(pageList, "pageTarget");
		length = pageTargets.length;

		if (!pageTargets || pageTargets.length === 0) {
			return list;
		}

		for (i = 0; i < length; ++i) {
			item = this.ncxItem(pageTargets[i]);
			list.push(item);
		}

		return list;
	}

	ncxItem(item) {
		var navLabel = qs(item, "navLabel");
		var navLabelText = qs(navLabel, "text");
		var pageText = navLabelText.textContent;
		var content = qs(item, "content");

		var href = content.getAttribute("src");
		var page = parseInt(pageText, 10);

		return {
			"href": href,
			"page": page,
		};
	}

	/**
	 * Page List Item
	 * @private
	 * @param  {node} item
	 * @return {object} pageListItem
	 */
	item(item){
		var content = qs(item, "a"),
				href = content.getAttribute("href") || "",
				text = content.textContent || "",
				page = parseInt(text),
				isCfi = href.indexOf("epubcfi"),
				split,
				packageUrl,
				cfi;

		if(isCfi != -1) {
			split = href.split("#");
			packageUrl = split[0];
			cfi = split.length > 1 ? split[1] : false;
			return {
				"cfi" : cfi,
				"href" : href,
				"packageUrl" : packageUrl,
				"page" : page
			};
		} else {
			return {
				"href" : href,
				"page" : page
			};
		}
	}

	/**
	 * Process pageList items
	 * @private
	 * @param  {array} pageList
	 */
	process(pageList){
		pageList.forEach(function(item){
			this.pages.push(item.page);
			if (item.cfi) {
				this.locations.push(item.cfi);
			}
		}, this);
		this.firstPage = parseInt(this.pages[0]);
		this.lastPage = parseInt(this.pages[this.pages.length-1]);
		this.totalPages = this.lastPage - this.firstPage;
	}

	/**
	 * Get a PageList result from a EpubCFI
	 * @param  {string} cfi EpubCFI String
	 * @return {number} page
	 */
	pageFromCfi(cfi){
		var pg = -1;

		// Check if the pageList has not been set yet
		if(this.locations.length === 0) {
			return -1;
		}

		// TODO: check if CFI is valid?

		// check if the cfi is in the location list
		// var index = this.locations.indexOf(cfi);
		var index = indexOfSorted(cfi, this.locations, this.epubcfi.compare);
		if(index != -1) {
			pg = this.pages[index];
		} else {
			// Otherwise add it to the list of locations
			// Insert it in the correct position in the locations page
			//index = EPUBJS.core.insert(cfi, this.locations, this.epubcfi.compare);
			index = locationOf(cfi, this.locations, this.epubcfi.compare);
			// Get the page at the location just before the new one, or return the first
			pg = index-1 >= 0 ? this.pages[index-1] : this.pages[0];
			if(pg !== undefined) {
				// Add the new page in so that the locations and page array match up
				//this.pages.splice(index, 0, pg);
			} else {
				pg = -1;
			}

		}
		return pg;
	}

	/**
	 * Get an EpubCFI from a Page List Item
	 * @param  {string | number} pg
	 * @return {string} cfi
	 */
	cfiFromPage(pg){
		var cfi = -1;
		// check that pg is an int
		if(typeof pg != "number"){
			pg = parseInt(pg);
		}

		// check if the cfi is in the page list
		// Pages could be unsorted.
		var index = this.pages.indexOf(pg);
		if(index != -1) {
			cfi = this.locations[index];
		}
		// TODO: handle pages not in the list
		return cfi;
	}

	/**
	 * Get a Page from Book percentage
	 * @param  {number} percent
	 * @return {number} page
	 */
	pageFromPercentage(percent){
		var pg = Math.round(this.totalPages * percent);
		return pg;
	}

	/**
	 * Returns a value between 0 - 1 corresponding to the location of a page
	 * @param  {number} pg the page
	 * @return {number} percentage
	 */
	percentageFromPage(pg){
		var percentage = (pg - this.firstPage) / this.totalPages;
		return Math.round(percentage * 1000) / 1000;
	}

	/**
	 * Returns a value between 0 - 1 corresponding to the location of a cfi
	 * @param  {string} cfi EpubCFI String
	 * @return {number} percentage
	 */
	percentageFromCfi(cfi){
		var pg = this.pageFromCfi(cfi);
		var percentage = this.percentageFromPage(pg);
		return percentage;
	}

	/**
	 * Destroy
	 */
	destroy() {
		this.pages = undefined;
		this.locations = undefined;
		this.epubcfi = undefined;

		this.pageList = undefined;

		this.toc = undefined;
		this.ncx = undefined;
	}
}

export default PageList;
