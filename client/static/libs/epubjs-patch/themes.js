import Url from "./utils/url";

/**
 * Themes to apply to displayed content
 * @class
 * @param {Rendition} rendition
 */
class Themes {
	constructor(rendition) {
		this.rendition = rendition;
		this._themes = {
			"default" : {
				"rules" : {},
				"url" : "",
				"serialized" : ""
			}
		};
		this._overrides = {};
		this._current = "default";
		this._injected = [];
		this.rendition.hooks.content.register(this.inject.bind(this));
		this.rendition.hooks.content.register(this.overrides.bind(this));

	}

	/**
	 * Add themes to be used by a rendition
	 * @param {object | Array<object> | string}
	 * @example themes.register("light", "http://example.com/light.css")
	 * @example themes.register("light", { "body": { "color": "purple"}})
	 * @example themes.register({ "light" : {...}, "dark" : {...}})
	 */
	register () {
		if (arguments.length === 0) {
			return;
		}
		if (arguments.length === 1 && typeof(arguments[0]) === "object") {
			return this.registerThemes(arguments[0]);
		}
		if (arguments.length === 1 && typeof(arguments[0]) === "string") {
			return this.default(arguments[0]);
		}
		if (arguments.length === 2 && typeof(arguments[1]) === "string") {
			return this.registerUrl(arguments[0], arguments[1]);
		}
		if (arguments.length === 2 && typeof(arguments[1]) === "object") {
			return this.registerRules(arguments[0], arguments[1]);
		}
	}

	/**
	 * Add a default theme to be used by a rendition
	 * @param {object | string} theme
	 * @example themes.register("http://example.com/default.css")
	 * @example themes.register({ "body": { "color": "purple"}})
	 */
	default (theme) {
		if (!theme) {
			return;
		}
		if (typeof(theme) === "string") {
			return this.registerUrl("default", theme);
		}
		if (typeof(theme) === "object") {
			return this.registerRules("default", theme);
		}
	}

	/**
	 * Register themes object
	 * @param {object} themes
	 */
	registerThemes (themes) {
		for (var theme in themes) {
			if (themes.hasOwnProperty(theme)) {
				if (typeof(themes[theme]) === "string") {
					this.registerUrl(theme, themes[theme]);
				} else {
					this.registerRules(theme, themes[theme]);
				}
			}
		}
	}

	/**
	 * Register a theme by passing its css as string
	 * @param {string} name 
	 * @param {string} css 
	 */
	registerCss (name, css) {
		this._themes[name] = { "serialized" : css };
		if (this._injected[name] || name == 'default') {
			this.update(name);
		}
	}

	/**
	 * Register a url
	 * @param {string} name
	 * @param {string} input
	 */
	registerUrl (name, input) {
		var url = new Url(input);
		this._themes[name] = { "url": url.toString() };
		if (this._injected[name] || name == 'default') {
			this.update(name);
		}
	}

	/**
	 * Register rule
	 * @param {string} name
	 * @param {object} rules
	 */
	registerRules (name, rules) {
		this._themes[name] = { "rules": rules };
		// TODO: serialize css rules
		if (this._injected[name] || name == 'default') {
			this.update(name);
		}
	}

	/**
	 * Select a theme
	 * @param {string} name
	 */
	select (name) {
		var prev = this._current;
		var contents;

		this._current = name;
		this.update(name);

		contents = this.rendition.getContents();
		contents.forEach( (content) => {
			content.removeClass(prev);
			content.addClass(name);
		});
	}

	/**
	 * Update a theme
	 * @param {string} name
	 */
	update (name) {
		var contents = this.rendition.getContents();
		contents.forEach( (content) => {
			this.add(name, content);
		});
	}

	/**
	 * Inject all themes into contents
	 * @param {Contents} contents
	 */
	inject (contents) {
		var links = [];
		var themes = this._themes;
		var theme;

		for (var name in themes) {
			if (themes.hasOwnProperty(name) && (name === this._current || name === "default")) {
				theme = themes[name];
				if((theme.rules && Object.keys(theme.rules).length > 0) || (theme.url && links.indexOf(theme.url) === -1)) {
					this.add(name, contents);
				}
				this._injected.push(name);
			}
		}

		if(this._current != "default") {
			contents.addClass(this._current);
		}
	}

	/**
	 * Add Theme to contents
	 * @param {string} name
	 * @param {Contents} contents
	 */
	add (name, contents) {
		var theme = this._themes[name];

		if (!theme || !contents) {
			return;
		}

		if (theme.url) {
			contents.addStylesheet(theme.url);
		} else if (theme.serialized) {
			contents.addStylesheetCss(theme.serialized, name);
			theme.injected = true;
		} else if (theme.rules) {
			contents.addStylesheetRules(theme.rules, name);
			theme.injected = true;
		}
	}

	/**
	 * Add override
	 * @param {string} name
	 * @param {string} value
	 * @param {boolean} priority
	 */
	override (name, value, priority) {
		var contents = this.rendition.getContents();

		this._overrides[name] = {
			value: value,
			priority: priority === true
		};

		contents.forEach( (content) => {
			content.css(name, this._overrides[name].value, this._overrides[name].priority);
		});
	}

	removeOverride (name) {
		var contents = this.rendition.getContents();

		delete this._overrides[name];

		contents.forEach( (content) => {
			content.css(name);
		});
	}

	/**
	 * Add all overrides
	 * @param {Content} content
	 */
	overrides (contents) {
		var overrides = this._overrides;

		for (var rule in overrides) {
			if (overrides.hasOwnProperty(rule)) {
				contents.css(rule, overrides[rule].value, overrides[rule].priority);
			}
		}
	}

	/**
	 * Adjust the font size of a rendition
	 * @param {number} size
	 */
	fontSize (size) {
		this.override("font-size", size);
	}

	/**
	 * Adjust the font-family of a rendition
	 * @param {string} f
	 */
	font (f) {
		this.override("font-family", f, true);
	}

	destroy() {
		this.rendition = undefined;
		this._themes = undefined;
		this._overrides = undefined;
		this._current = undefined;
		this._injected = undefined;
	}

}

export default Themes;
