// Detect RTL scroll type
// Based on https://github.com/othree/jquery.rtl-scroll-type/blob/master/src/jquery.rtl-scroll.js
export default function scrollType() {
	var type = "reverse";
	var definer = createDefiner();
	document.body.appendChild(definer);

	if (definer.scrollLeft > 0) {
		type = "default";
	} else {
		if (typeof Element !== 'undefined' && Element.prototype.scrollIntoView) {
			definer.children[0].children[1].scrollIntoView();
			if (definer.scrollLeft < 0) {
				type = "negative";
			}
		} else {
			definer.scrollLeft = 1;
			if (definer.scrollLeft === 0) {
				type = "negative";
			}
		}
	}

	document.body.removeChild(definer);
	return type;
}

export function createDefiner() {
	var definer = document.createElement('div');
	definer.dir="rtl";

	definer.style.position = "fixed";
	definer.style.width = "1px";
	definer.style.height = "1px";
	definer.style.top = "0px";
	definer.style.left = "0px";
	definer.style.overflow = "hidden";

	var innerDiv = document.createElement('div');
	innerDiv.style.width = "2px";

	var spanA = document.createElement('span');
	spanA.style.width = "1px";
	spanA.style.display = "inline-block";

	var spanB = document.createElement('span');
	spanB.style.width = "1px";
	spanB.style.display = "inline-block";

	innerDiv.appendChild(spanA);
	innerDiv.appendChild(spanB);
	definer.appendChild(innerDiv);

	return definer;
}
