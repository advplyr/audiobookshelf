'use strict';
module.exports = ( () => {
    function replaceWithRange(text, init, end, step) {

        const numbers = [];
        let last = parseInt(end);
        let first = parseInt(init);

        if(first > last){
            last = parseInt(init);
            first = parseInt(end);
        }

        let increment = 1;
        if(step !== undefined){
            increment = parseInt(step);
            // Leave an invalid step untouched so that the pattern validation rejects the expression.
            if(isNaN(increment) || increment < 1){
                return text;
            }
        }

        for(let i = first; i <= last; i += increment) {
            numbers.push(i);
        }

        return numbers.join();
    }

    function convertRange(expression){
        const rangeRegEx = /(\d+)-(\d+)(?:\/(\d+)(?=$|,))?/g;
        return expression.replace(rangeRegEx, (text, init, end, step) => replaceWithRange(text, init, end, step));
    }

    function convertAllRanges(expressions){
        for(let i = 0; i < expressions.length; i++){
            expressions[i] = convertRange(expressions[i]);
        }
        return expressions;
    }

    return convertAllRanges;
})();
