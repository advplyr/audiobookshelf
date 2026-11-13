const convert = (() => {
    function convertAsterisk(expression: string, replacement: string){
        if(expression.indexOf('*') !== -1){
            return expression.replace('*', replacement);
        }
        return expression;
    }

    function convertAsterisksToRanges(expressions: string[]){
        expressions[0] = convertAsterisk(expressions[0], '0-59');
        expressions[1] = convertAsterisk(expressions[1], '0-59');
        expressions[2] = convertAsterisk(expressions[2], '0-23');
        expressions[3] = convertAsterisk(expressions[3], '1-31');
        expressions[4] = convertAsterisk(expressions[4], '1-12');
        expressions[5] = convertAsterisk(expressions[5], '0-6');
        return expressions;
    }

    return convertAsterisksToRanges;
})();

export = convert;
