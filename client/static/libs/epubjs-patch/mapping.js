import EpubCFI from "./epubcfi";
import { nodeBounds } from "./utils/core";

/**
 * Map text locations to CFI ranges
 * @class
 * @param {Layout} layout Layout to apply
 * @param {string} [direction="ltr"] Text direction
 * @param {string} [axis="horizontal"] vertical or horizontal axis
 * @param {boolean} [dev] toggle developer highlighting
 */
class Mapping {
	constructor(layout, direction, axis, dev=false) {
		this.layout = layout;
		this.horizontal = (axis === "horizontal") ? true : false;
		this.direction = direction || "ltr";
		this._dev = dev;
	}

	/**
	 * Find CFI pairs for entire section at once
	 */
	section(view) {
		var ranges = this.findRanges(view);
		var map = this.rangeListToCfiList(view.section.cfiBase, ranges);

		return map;
	}

	/**
	 * Find CFI pairs for a page
	 * @param {Contents} contents Contents from view
	 * @param {string} cfiBase string of the base for a cfi
	 * @param {number} start position to start at
	 * @param {number} end position to end at
	 */
	page(contents, cfiBase, start, end) {
		var root = contents && contents.document ? contents.document.body : false;
		var result;

		if (!root) {
			return;
		}

		result = this.rangePairToCfiPair(cfiBase, {
			start: this.findStart(root, start, end),
			end: this.findEnd(root, start, end)
		});

		if (this._dev === true) {
			let doc = contents.document;
			let startRange = new EpubCFI(result.start).toRange(doc);
			let endRange = new EpubCFI(result.end).toRange(doc);

			let selection = doc.defaultView.getSelection();
			let r = doc.createRange();
			selection.removeAllRanges();
			r.setStart(startRange.startContainer, startRange.startOffset);
			r.setEnd(endRange.endContainer, endRange.endOffset);
			selection.addRange(r);
		}

		return result;
	}

	/**
	 * Walk a node, preforming a function on each node it finds
	 * @private
	 * @param {Node} root Node to walkToNode
	 * @param {function} func walk function
	 * @return {*} returns the result of the walk function
	 */
	walk(root, func) {
		// IE11 has strange issue, if root is text node IE throws exception on
		// calling treeWalker.nextNode(), saying
		// Unexpected call to method or property access instead of returning null value
		if(root && root.nodeType === Node.TEXT_NODE) {
			return;
		}
		// safeFilter is required so that it can work in IE as filter is a function for IE
		// and for other browser filter is an object.
		var filter = {
			acceptNode: function(node) {
				if (node.data.trim().length > 0) {
					return NodeFilter.FILTER_ACCEPT;
				} else {
					return NodeFilter.FILTER_REJECT;
				}
			}
		};
		var safeFilter = filter.acceptNode;
		safeFilter.acceptNode = filter.acceptNode;

		var treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, safeFilter, false);
		var node;
		var result;
		while ((node = treeWalker.nextNode())) {
			result = func(node);
			if(result) break;
		}

		return result;
	}

	findRanges(view){
		var columns = [];
		var scrollWidth = view.contents.scrollWidth();
		var spreads = Math.ceil( scrollWidth / this.layout.spreadWidth);
		var count = spreads * this.layout.divisor;
		var columnWidth = this.layout.columnWidth;
		var gap = this.layout.gap;
		var start, end;

		for (var i = 0; i < count.pages; i++) {
			start = (columnWidth + gap) * i;
			end = (columnWidth * (i+1)) + (gap * i);
			columns.push({
				start: this.findStart(view.document.body, start, end),
				end: this.findEnd(view.document.body, start, end)
			});
		}

		return columns;
	}

	/**
	 * Find Start Range
	 * @private
	 * @param {Node} root root node
	 * @param {number} start position to start at
	 * @param {number} end position to end at
	 * @return {Range}
	 */
	findStart(root, start, end){
		var stack = [root];
		var $el;
		var found;
		var $prev = root;

		while (stack.length) {

			$el = stack.shift();

			found = this.walk($el, (node) => {
				var left, right, top, bottom;
				var elPos;
				var elRange;


				elPos = nodeBounds(node);

				if (this.horizontal && this.direction === "ltr") {

					left = this.horizontal ? elPos.left : elPos.top;
					right = this.horizontal ? elPos.right : elPos.bottom;

					if( left >= start && left <= end ) {
						return node;
					} else if (right > start) {
						return node;
					} else {
						$prev = node;
						stack.push(node);
					}

				} else if (this.horizontal && this.direction === "rtl") {

					left = elPos.left;
					right = elPos.right;

					if( right <= end && right >= start ) {
						return node;
					} else if (left < end) {
						return node;
					} else {
						$prev = node;
						stack.push(node);
					}

				} else {

					top = elPos.top;
					bottom = elPos.bottom;

					if( top >= start && top <= end ) {
						return node;
					} else if (bottom > start) {
						return node;
					} else {
						$prev = node;
						stack.push(node);
					}

				}


			});

			if(found) {
				return this.findTextStartRange(found, start, end);
			}

		}

		// Return last element
		return this.findTextStartRange($prev, start, end);
	}

	/**
	 * Find End Range
	 * @private
	 * @param {Node} root root node
	 * @param {number} start position to start at
	 * @param {number} end position to end at
	 * @return {Range}
	 */
	findEnd(root, start, end){
		var stack = [root];
		var $el;
		var $prev = root;
		var found;

		while (stack.length) {

			$el = stack.shift();

			found = this.walk($el, (node) => {

				var left, right, top, bottom;
				var elPos;
				var elRange;

				elPos = nodeBounds(node);

				if (this.horizontal && this.direction === "ltr") {

					left = Math.round(elPos.left);
					right = Math.round(elPos.right);

					if(left > end && $prev) {
						return $prev;
					} else if(right > end) {
						return node;
					} else {
						$prev = node;
						stack.push(node);
					}

				} else if (this.horizontal && this.direction === "rtl") {

					left = Math.round(this.horizontal ? elPos.left : elPos.top);
					right = Math.round(this.horizontal ? elPos.right : elPos.bottom);

					if(right < start && $prev) {
						return $prev;
					} else if(left < start) {
						return node;
					} else {
						$prev = node;
						stack.push(node);
					}

				} else {

					top = Math.round(elPos.top);
					bottom = Math.round(elPos.bottom);

					if(top > end && $prev) {
						return $prev;
					} else if(bottom > end) {
						return node;
					} else {
						$prev = node;
						stack.push(node);
					}

				}

			});


			if(found){
				return this.findTextEndRange(found, start, end);
			}

		}

		// end of chapter
		return this.findTextEndRange($prev, start, end);
	}

	/**
	 * Find Text Start Range
	 * @private
	 * @param {Node} root root node
	 * @param {number} start position to start at
	 * @param {number} end position to end at
	 * @return {Range}
	 */
	findTextStartRange(node, start, end){
		var ranges = this.splitTextNodeIntoRanges(node);
		var range;
		var pos;
		var left, top, right;

		for (var i = 0; i < ranges.length; i++) {
			range = ranges[i];

			pos = range.getBoundingClientRect();

			if (this.horizontal && this.direction === "ltr") {

				left = pos.left;
				if( left >= start ) {
					return range;
				}

			} else if (this.horizontal && this.direction === "rtl") {

				right = pos.right;
				if( right <= end ) {
					return range;
				}

			} else {

				top = pos.top;
				if( top >= start ) {
					return range;
				}

			}

			// prev = range;

		}

		return ranges[0];
	}

	/**
	 * Find Text End Range
	 * @private
	 * @param {Node} root root node
	 * @param {number} start position to start at
	 * @param {number} end position to end at
	 * @return {Range}
	 */
	findTextEndRange(node, start, end){
		var ranges = this.splitTextNodeIntoRanges(node);
		var prev;
		var range;
		var pos;
		var left, right, top, bottom;

		for (var i = 0; i < ranges.length; i++) {
			range = ranges[i];

			pos = range.getBoundingClientRect();

			if (this.horizontal && this.direction === "ltr") {

				left = pos.left;
				right = pos.right;

				if(left > end && prev) {
					return prev;
				} else if(right > end) {
					return range;
				}

			} else if (this.horizontal && this.direction === "rtl") {

				left = pos.left
				right = pos.right;

				if(right < start && prev) {
					return prev;
				} else if(left < start) {
					return range;
				}

			} else {

				top = pos.top;
				bottom = pos.bottom;

				if(top > end && prev) {
					return prev;
				} else if(bottom > end) {
					return range;
				}

			}


			prev = range;

		}

		// Ends before limit
		return ranges[ranges.length-1];

	}

	/**
	 * Split up a text node into ranges for each word
	 * @private
	 * @param {Node} root root node
	 * @param {string} [_splitter] what to split on
	 * @return {Range[]}
	 */
	splitTextNodeIntoRanges(node, _splitter){
		var ranges = [];
		var textContent = node.textContent || "";
		var text = textContent.trim();
		var range;
		var doc = node.ownerDocument;
		var splitter = _splitter || " ";

		var pos = text.indexOf(splitter);

		if(pos === -1 || node.nodeType != Node.TEXT_NODE) {
			range = doc.createRange();
			range.selectNodeContents(node);
			return [range];
		}

		range = doc.createRange();
		range.setStart(node, 0);
		range.setEnd(node, pos);
		ranges.push(range);
		range = false;

		while ( pos != -1 ) {

			pos = text.indexOf(splitter, pos + 1);
			if(pos > 0) {

				if(range) {
					range.setEnd(node, pos);
					ranges.push(range);
				}

				range = doc.createRange();
				range.setStart(node, pos+1);
			}
		}

		if(range) {
			range.setEnd(node, text.length);
			ranges.push(range);
		}

		return ranges;
	}


	/**
	 * Turn a pair of ranges into a pair of CFIs
	 * @private
	 * @param {string} cfiBase base string for an EpubCFI
	 * @param {object} rangePair { start: Range, end: Range }
	 * @return {object} { start: "epubcfi(...)", end: "epubcfi(...)" }
	 */
	rangePairToCfiPair(cfiBase, rangePair){

		var startRange = rangePair.start;
		var endRange = rangePair.end;

		startRange.collapse(true);
		endRange.collapse(false);

		let startCfi = new EpubCFI(startRange, cfiBase).toString();
		let endCfi = new EpubCFI(endRange, cfiBase).toString();

		return {
			start: startCfi,
			end: endCfi
		};

	}

	rangeListToCfiList(cfiBase, columns){
		var map = [];
		var cifPair;

		for (var i = 0; i < columns.length; i++) {
			cifPair = this.rangePairToCfiPair(cfiBase, columns[i]);

			map.push(cifPair);

		}

		return map;
	}

	/**
	 * Set the axis for mapping
	 * @param {string} axis horizontal | vertical
	 * @return {boolean} is it horizontal?
	 */
	axis(axis) {
		if (axis) {
			this.horizontal = (axis === "horizontal") ? true : false;
		}
		return this.horizontal;
	}
}

export default Mapping;
