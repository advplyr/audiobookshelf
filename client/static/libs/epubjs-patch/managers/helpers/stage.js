import {uuid, isNumber, isElement, windowBounds, extend} from "../../utils/core";
import throttle from 'lodash/throttle'

class Stage {
	constructor(_options) {
		this.settings = _options || {};
		this.id = "epubjs-container-" + uuid();

		this.container = this.create(this.settings);

		if(this.settings.hidden) {
			this.wrapper = this.wrap(this.container);
		}

	}

	/*
	* Creates an element to render to.
	* Resizes to passed width and height or to the elements size
	*/
	create(options){
		let height  = options.height;// !== false ? options.height : "100%";
		let width   = options.width;// !== false ? options.width : "100%";
		let overflow  = options.overflow || false;
		let axis = options.axis || "vertical";
		let direction = options.direction;

		extend(this.settings, options);

		if(options.height && isNumber(options.height)) {
			height = options.height + "px";
		}

		if(options.width && isNumber(options.width)) {
			width = options.width + "px";
		}

		// Create new container element
		let container = document.createElement("div");

		container.id = this.id;
		container.classList.add("epub-container");

		// Style Element
		// container.style.fontSize = "0";
		container.style.wordSpacing = "0";
		container.style.lineHeight = "0";
		container.style.verticalAlign = "top";
		container.style.position = "relative";

		if(axis === "horizontal") {
			// container.style.whiteSpace = "nowrap";
			container.style.display = "flex";
			container.style.flexDirection = "row";
			container.style.flexWrap = "nowrap";
		}

		if(width){
			container.style.width = width;
		}

		if(height){
			container.style.height = height;
		}

		if (overflow) {
			if (overflow === "scroll" && axis === "vertical") {
				container.style["overflow-y"] = overflow;
				container.style["overflow-x"] = "hidden";
			} else if (overflow === "scroll" && axis === "horizontal") {
				container.style["overflow-y"] = "hidden";
				container.style["overflow-x"] = overflow;
			} else {
				container.style["overflow"] = overflow;
			}
		}

		if (direction) {
			container.dir = direction;
			container.style["direction"] = direction;
		}

		if (direction && this.settings.fullsize) {
			document.body.style["direction"] = direction;
		}

		return container;
	}

	wrap(container) {
		var wrapper = document.createElement("div");

		wrapper.style.visibility = "hidden";
		wrapper.style.overflow = "hidden";
		wrapper.style.width = "0";
		wrapper.style.height = "0";

		wrapper.appendChild(container);
		return wrapper;
	}


	getElement(_element){
		var element;

		if(isElement(_element)) {
			element = _element;
		} else if (typeof _element === "string") {
			element = document.getElementById(_element);
		}

		if(!element){
			throw new Error("Not an Element");
		}

		return element;
	}

	attachTo(what){

		var element = this.getElement(what);
		var base;

		if(!element){
			return;
		}

		if(this.settings.hidden) {
			base = this.wrapper;
		} else {
			base = this.container;
		}

		element.appendChild(base);

		this.element = element;

		return element;

	}

	getContainer() {
		return this.container;
	}

	onResize(func){
		// Only listen to window for resize event if width and height are not fixed.
		// This applies if it is set to a percent or auto.
		if(!isNumber(this.settings.width) ||
			 !isNumber(this.settings.height) ) {
			this.resizeFunc = throttle(func, 50);
			window.addEventListener("resize", this.resizeFunc, false);
		}

	}

	onOrientationChange(func){
		this.orientationChangeFunc = func;
		window.addEventListener("orientationchange", this.orientationChangeFunc, false);
	}

	size(width, height){
		var bounds;
		let _width = width || this.settings.width;
		let _height = height || this.settings.height;

		// If width or height are set to false, inherit them from containing element
		if(width === null) {
			bounds = this.element.getBoundingClientRect();

			if(bounds.width) {
				width = Math.floor(bounds.width);
				this.container.style.width = width + "px";
			}
		} else {
			if (isNumber(width)) {
				this.container.style.width = width + "px";
			} else {
				this.container.style.width = width;
			}
		}

		if(height === null) {
			bounds = bounds || this.element.getBoundingClientRect();

			if(bounds.height) {
				height = bounds.height;
				this.container.style.height = height + "px";
			}

		} else {
			if (isNumber(height)) {
				this.container.style.height = height + "px";
			} else {
				this.container.style.height = height;
			}
		}

		if(!isNumber(width)) {
			width = this.container.clientWidth;
		}

		if(!isNumber(height)) {
			height = this.container.clientHeight;
		}

		this.containerStyles = window.getComputedStyle(this.container);

		this.containerPadding = {
			left: parseFloat(this.containerStyles["padding-left"]) || 0,
			right: parseFloat(this.containerStyles["padding-right"]) || 0,
			top: parseFloat(this.containerStyles["padding-top"]) || 0,
			bottom: parseFloat(this.containerStyles["padding-bottom"]) || 0
		};

		// Bounds not set, get them from window
		let _windowBounds = windowBounds();
		let bodyStyles = window.getComputedStyle(document.body);
		let bodyPadding = {
			left: parseFloat(bodyStyles["padding-left"]) || 0,
			right: parseFloat(bodyStyles["padding-right"]) || 0,
			top: parseFloat(bodyStyles["padding-top"]) || 0,
			bottom: parseFloat(bodyStyles["padding-bottom"]) || 0
		};

		if (!_width) {
			width = _windowBounds.width -
								bodyPadding.left -
								bodyPadding.right;
		}

		if ((this.settings.fullsize && !_height) || !_height) {
			height = _windowBounds.height -
								bodyPadding.top -
								bodyPadding.bottom;
		}

		return {
			width: width -
							this.containerPadding.left -
							this.containerPadding.right,
			height: height -
							this.containerPadding.top -
							this.containerPadding.bottom
		};

	}

	bounds(){
		let box;
		if (this.container.style.overflow !== "visible") {
			box = this.container && this.container.getBoundingClientRect();
		}

		if(!box || !box.width || !box.height) {
			return windowBounds();
		} else {
			return box;
		}

	}

	getSheet(){
		var style = document.createElement("style");

		// WebKit hack --> https://davidwalsh.name/add-rules-stylesheets
		style.appendChild(document.createTextNode(""));

		document.head.appendChild(style);

		return style.sheet;
	}

	addStyleRules(selector, rulesArray){
		var scope = "#" + this.id + " ";
		var rules = "";

		if(!this.sheet){
			this.sheet = this.getSheet();
		}

		rulesArray.forEach(function(set) {
			for (var prop in set) {
				if(set.hasOwnProperty(prop)) {
					rules += prop + ":" + set[prop] + ";";
				}
			}
		});

		this.sheet.insertRule(scope + selector + " {" + rules + "}", 0);
	}

	axis(axis) {
		if(axis === "horizontal") {
			this.container.style.display = "flex";
			this.container.style.flexDirection = "row";
			this.container.style.flexWrap = "nowrap";
		} else {
			this.container.style.display = "block";
		}
		this.settings.axis = axis;
	}

	// orientation(orientation) {
	// 	if (orientation === "landscape") {
	//
	// 	} else {
	//
	// 	}
	//
	// 	this.orientation = orientation;
	// }

	direction(dir) {
		if (this.container) {
			this.container.dir = dir;
			this.container.style["direction"] = dir;
		}

		if (this.settings.fullsize) {
			document.body.style["direction"] = dir;
		}
		this.settings.dir = dir;
	}

	overflow(overflow) {
		if (this.container) {
			if (overflow === "scroll" && this.settings.axis === "vertical") {
				this.container.style["overflow-y"] = overflow;
				this.container.style["overflow-x"] = "hidden";
			} else if (overflow === "scroll" && this.settings.axis === "horizontal") {
				this.container.style["overflow-y"] = "hidden";
				this.container.style["overflow-x"] = overflow;
			} else {
				this.container.style["overflow"] = overflow;
			}
		}
		this.settings.overflow = overflow;
	}

	destroy() {
		var base;

		if (this.element) {

			if(this.settings.hidden) {
				base = this.wrapper;
			} else {
				base = this.container;
			}

			if(this.element.contains(this.container)) {
				this.element.removeChild(this.container);
			}

			window.removeEventListener("resize", this.resizeFunc);
			window.removeEventListener("orientationChange", this.orientationChangeFunc);

		}
	}
}

export default Stage;
