const convert = ( () => {
    function replaceWithRange(expression: string, text: string, init: string, end: string) {

        const numbers = [];
        let last = parseInt(end);
        let first = parseInt(init);

        if(first > last){
            last = parseInt(init);
            first = parseInt(end);
        }

        for(let i = first; i <= last; i++) {
            numbers.push(i);
        }

        return expression.replace(new RegExp(text, 'i'), numbers.join());
    }

    function convertRange(expression: string){
        const rangeRegEx = /(\d+)-(\d+)/;
        let match = rangeRegEx.exec(expression);
        while(match !== null && match.length > 0){
            expression = replaceWithRange(expression, match[0], match[1], match[2]);
            match = rangeRegEx.exec(expression);
        }
        return expression;
    }

    function convertAllRanges(expressions: string[]){
        for(let i = 0; i < expressions.length; i++){
            expressions[i] = convertRange(expressions[i]);
        }
        return expressions;
    }

    return convertAllRanges;
})();

export = convert;
