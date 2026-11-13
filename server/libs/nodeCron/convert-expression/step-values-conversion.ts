
const convert = (() => {
    function convertSteps(expressions: string[]){
        var stepValuePattern = /^(.+)\/(\w+)$/;
        for(var i = 0; i < expressions.length; i++){
            var match = stepValuePattern.exec(expressions[i]);
            var isStepValue = match !== null && match.length > 0;
            if(isStepValue && match){
                var baseDivider = match[2];
                if(isNaN(Number(baseDivider))){
                    throw new Error(baseDivider + ' is not a valid step value');
                }
                var values = match[1].split(',');
                var stepValues = [];
                var divider = parseInt(baseDivider, 10);
                for(var j = 0; j <= values.length; j++){
                    var value = parseInt(values[j], 10);
                    if(value % divider === 0){
                        stepValues.push(value);
                    }
                }
                expressions[i] = stepValues.join(',');
            }
        }
        return expressions;
    }

    return convertSteps;
})();

export = convert;
