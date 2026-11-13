const convert = (() => {
    const months = ['january','february','march','april','may','june','july',
        'august','september','october','november','december'];
    const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug',
        'sep', 'oct', 'nov', 'dec'];

    function convertMonthName(expression: string, items: string[]){
        for(let i = 0; i < items.length; i++){
            expression = expression.replace(new RegExp(items[i], 'gi'), String(i + 1));
        }
        return expression;
    }

    function interprete(monthExpression: string){
        monthExpression = convertMonthName(monthExpression, months);
        monthExpression = convertMonthName(monthExpression, shortMonths);
        return monthExpression;
    }

    return interprete;
})();

export = convert;
