import {extend, defer, requestAnimationFrame, prefixed} from "../../utils/core";
import { EVENTS, DOM_EVENTS } from "../../utils/constants";
import { EventEmitter } from "events";

// easing equations from https://github.com/danro/easing-js/blob/master/easing.js
const PI_D2 = (Math.PI / 2);
const EASING_EQUATIONS = {
		easeOutSine: function (pos) {
				return Math.sin(pos * PI_D2);
		},
		easeInOutSine: function (pos) {
				return (-0.5 * (Math.cos(Math.PI * pos) - 1));
		},
		easeInOutQuint: function (pos) {
				if ((pos /= 0.5) < 1) {
						return 0.5 * Math.pow(pos, 5);
				}
				return 0.5 * (Math.pow((pos - 2), 5) + 2);
		},
		easeInCubic: function(pos) {
			return Math.pow(pos, 3);
  	}
};

class Snap extends EventEmitter {
	constructor(manager, options) {
		super();

		this.settings = extend({
			duration: 80,
			minVelocity: 0.2,
			minDistance: 10,
			easing: EASING_EQUATIONS['easeInCubic']
		}, options || {});

		this.supportsTouch = this.supportsTouch();

		if (this.supportsTouch) {
			this.setup(manager);
		}
	}

	setup(manager) {
		this.manager = manager;

		this.layout = this.manager.layout;

		this.fullsize = this.manager.settings.fullsize;
		if (this.fullsize) {
			this.element = this.manager.stage.element;
			this.scroller = window;
			this.disableScroll();
		} else {
			this.element = this.manager.stage.container;
			this.scroller = this.element;
			this.element.style["WebkitOverflowScrolling"] = "touch";
		}

		// this.overflow = this.manager.overflow;

		// set lookahead offset to page width
		this.manager.settings.offset = this.layout.width;
		this.manager.settings.afterScrolledTimeout = this.settings.duration * 2;

		this.isVertical = this.manager.settings.axis === "vertical";

		// disable snapping if not paginated or axis in not horizontal
		if (!this.manager.isPaginated || this.isVertical) {
			return;
		}

		this.touchCanceler = false;
		this.resizeCanceler = false;
		this.snapping = false;


		this.scrollLeft;
		this.scrollTop;

		this.startTouchX = undefined;
		this.startTouchY = undefined;
		this.startTime = undefined;
		this.endTouchX = undefined;
		this.endTouchY = undefined;
		this.endTime = undefined;

		this.addListeners();
	}

	supportsTouch() {
		if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
			return true;
		}

		return false;
	}

	disableScroll() {
		this.element.style.overflow = "hidden";
	}

	enableScroll() {
		this.element.style.overflow = "";
	}

	addListeners() {
		this._onResize = this.onResize.bind(this);
		window.addEventListener('resize', this._onResize);

		this._onScroll = this.onScroll.bind(this);
		this.scroller.addEventListener('scroll', this._onScroll);

		this._onTouchStart = this.onTouchStart.bind(this);
		this.scroller.addEventListener('touchstart', this._onTouchStart, { passive: true });
		this.on('touchstart', this._onTouchStart);

		this._onTouchMove = this.onTouchMove.bind(this);
		this.scroller.addEventListener('touchmove', this._onTouchMove, { passive: true });
		this.on('touchmove', this._onTouchMove);

		this._onTouchEnd = this.onTouchEnd.bind(this);
		this.scroller.addEventListener('touchend', this._onTouchEnd, { passive: true });
		this.on('touchend', this._onTouchEnd);

		this._afterDisplayed = this.afterDisplayed.bind(this);
		this.manager.on(EVENTS.MANAGERS.ADDED, this._afterDisplayed);
	}

	removeListeners() {
		window.removeEventListener('resize', this._onResize);
		this._onResize = undefined;

		this.scroller.removeEventListener('scroll', this._onScroll);
		this._onScroll = undefined;

		this.scroller.removeEventListener('touchstart', this._onTouchStart, { passive: true });
		this.off('touchstart', this._onTouchStart);
		this._onTouchStart = undefined;

		this.scroller.removeEventListener('touchmove', this._onTouchMove, { passive: true });
		this.off('touchmove', this._onTouchMove);
		this._onTouchMove = undefined;

		this.scroller.removeEventListener('touchend', this._onTouchEnd, { passive: true });
		this.off('touchend', this._onTouchEnd);
		this._onTouchEnd = undefined;

		this.manager.off(EVENTS.MANAGERS.ADDED, this._afterDisplayed);
		this._afterDisplayed = undefined;
	}

	afterDisplayed(view) {
		let contents = view.contents;
		["touchstart", "touchmove", "touchend"].forEach((e) => {
			contents.on(e, (ev) => this.triggerViewEvent(ev, contents));
		});
	}

	triggerViewEvent(e, contents){
		this.emit(e.type, e, contents);
	}

	onScroll(e) {
		this.scrollLeft = this.fullsize ? window.scrollX : this.scroller.scrollLeft;
		this.scrollTop = this.fullsize ? window.scrollY : this.scroller.scrollTop;
	}

	onResize(e) {
		this.resizeCanceler = true;
	}

	onTouchStart(e) {
		let { screenX, screenY } = e.touches[0];

		if (this.fullsize) {
			this.enableScroll();
		}

		this.touchCanceler = true;

		if (!this.startTouchX) {
			this.startTouchX = screenX;
			this.startTouchY = screenY;
			this.startTime = this.now();
		}

		this.endTouchX = screenX;
		this.endTouchY = screenY;
		this.endTime = this.now();
	}

	onTouchMove(e) {
		let { screenX, screenY } = e.touches[0];
		let deltaY = Math.abs(screenY - this.endTouchY);

		this.touchCanceler = true;


		if (!this.fullsize && deltaY < 10) {
			this.element.scrollLeft -= screenX - this.endTouchX;
		}

		this.endTouchX = screenX;
		this.endTouchY = screenY;
		this.endTime = this.now();
	}

	onTouchEnd(e) {
		if (this.fullsize) {
			this.disableScroll();
		}

		this.touchCanceler = false;

		let swipped = this.wasSwiped();

		if (swipped !== 0) {
			this.snap(swipped);
		} else {
			this.snap();
		}

		this.startTouchX = undefined;
		this.startTouchY = undefined;
		this.startTime = undefined;
		this.endTouchX = undefined;
		this.endTouchY = undefined;
		this.endTime = undefined;
	}

	wasSwiped() {
		let snapWidth = this.layout.pageWidth * this.layout.divisor;
		let distance = (this.endTouchX - this.startTouchX);
		let absolute = Math.abs(distance);
		let time = this.endTime - this.startTime;
		let velocity = (distance / time);
		let minVelocity = this.settings.minVelocity;

		if (absolute <= this.settings.minDistance || absolute >= snapWidth) {
			return 0;
		}

		if (velocity > minVelocity) {
			// previous
			return -1;
		} else if (velocity < -minVelocity) {
			// next
			return 1;
		}
	}

	needsSnap() {
		let left = this.scrollLeft;
		let snapWidth = this.layout.pageWidth * this.layout.divisor;
		return (left % snapWidth) !== 0;
	}

	snap(howMany=0) {
		let left = this.scrollLeft;
		let snapWidth = this.layout.pageWidth * this.layout.divisor;
		let snapTo = Math.round(left / snapWidth) * snapWidth;

		if (howMany) {
			snapTo += (howMany * snapWidth);
		}

		return this.smoothScrollTo(snapTo);
	}

	smoothScrollTo(destination) {
		const deferred = new defer();
		const start = this.scrollLeft;
		const startTime = this.now();

		const duration = this.settings.duration;
		const easing = this.settings.easing;

		this.snapping = true;

		// add animation loop
		function tick() {
			const now = this.now();
			const time = Math.min(1, ((now - startTime) / duration));
			const timeFunction = easing(time);


			if (this.touchCanceler || this.resizeCanceler) {
				this.resizeCanceler = false;
				this.snapping = false;
				deferred.resolve();
				return;
			}

			if (time < 1) {
					window.requestAnimationFrame(tick.bind(this));
					this.scrollTo(start + ((destination - start) * time), 0);
			} else {
					this.scrollTo(destination, 0);
					this.snapping = false;
					deferred.resolve();
			}
		}

		tick.call(this);

		return deferred.promise;
	}

	scrollTo(left=0, top=0) {
		if (this.fullsize) {
			window.scroll(left, top);
		} else {
			this.scroller.scrollLeft = left;
			this.scroller.scrollTop = top;
		}
	}

	now() {
		return ('now' in window.performance) ? performance.now() : new Date().getTime();
	}

	destroy() {
		if (!this.scroller) {
			return;
		}

		if (this.fullsize) {
			this.enableScroll();
		}

		this.removeListeners();

		this.scroller = undefined;
	}
}

Object.assign(Snap.prototype, EventEmitter.prototype);

export default Snap;
