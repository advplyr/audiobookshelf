/**
 * Hooks allow for injecting functions that must all complete in order before finishing
 * They will execute in parallel but all must finish before continuing
 * Functions may return a promise if they are async.
 * @param {any} context scope of this
 * @example this.content = new EPUBJS.Hook(this);
 */
class Hook {
	constructor(context){
		this.context = context || this;
		this.hooks = [];
	}

	/**
	 * Adds a function to be run before a hook completes
	 * @example this.content.register(function(){...});
	 */
	register(){
		for(var i = 0; i < arguments.length; ++i) {
			if (typeof arguments[i]  === "function") {
				this.hooks.push(arguments[i]);
			} else {
				// unpack array
				for(var j = 0; j < arguments[i].length; ++j) {
					this.hooks.push(arguments[i][j]);
				}
			}
		}
	}

	/**
	 * Removes a function
	 * @example this.content.deregister(function(){...});
	 */
	deregister(func){
		let hook;
		for (let i = 0; i < this.hooks.length; i++) {
			hook = this.hooks[i];
			if (hook === func) {
				this.hooks.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * Triggers a hook to run all functions
	 * @example this.content.trigger(args).then(function(){...});
	 */
	trigger(){
		var args = arguments;
		var context = this.context;
		var promises = [];

		this.hooks.forEach(function(task) {
			try {
				var executing = task.apply(context, args);
			} catch (err) {
				console.log(err);
			}

			if(executing && typeof executing["then"] === "function") {
				// Task is a function that returns a promise
				promises.push(executing);
			}
			// Otherwise Task resolves immediately, continue
		});


		return Promise.all(promises);
	}

	// Adds a function to be run before a hook completes
	list(){
		return this.hooks;
	}

	clear(){
		return this.hooks = [];
	}
}
export default Hook;
