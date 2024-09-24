import {qs, qsa } from "./utils/core";

/**
 * Open DisplayOptions Format Parser
 * @class
 * @param {document} displayOptionsDocument XML
 */
class DisplayOptions {
	constructor(displayOptionsDocument) {
		this.interactive = "";
		this.fixedLayout = "";
		this.openToSpread = "";
		this.orientationLock = "";

		if (displayOptionsDocument) {
			this.parse(displayOptionsDocument);
		}
	}

	/**
	 * Parse XML
	 * @param  {document} displayOptionsDocument XML
	 * @return {DisplayOptions} self
	 */
	parse(displayOptionsDocument) {
		if(!displayOptionsDocument) {
			return this;
		}

		const displayOptionsNode = qs(displayOptionsDocument, "display_options");
		if(!displayOptionsNode) {
			return this;
		} 

		const options = qsa(displayOptionsNode, "option");
		options.forEach((el) => {
			let value = "";

			if (el.childNodes.length) {
				value = el.childNodes[0].nodeValue;
			}

			switch (el.attributes.name.value) {
			    case "interactive":
			        this.interactive = value;
			        break;
			    case "fixed-layout":
			        this.fixedLayout = value;
			        break;
			    case "open-to-spread":
			        this.openToSpread = value;
			        break;
			    case "orientation-lock":
			        this.orientationLock = value;
			        break;
			}
		});

		return this;
	}

	destroy() {
		this.interactive = undefined;
		this.fixedLayout = undefined;
		this.openToSpread = undefined;
		this.orientationLock = undefined;
	}
}

export default DisplayOptions;
