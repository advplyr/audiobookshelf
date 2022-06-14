'use strict';
module.exports = (() => {
    const months = ['january','february','march','april','may','june','july',
        'august','september','october','november','december'];
    const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug',
        'sep', 'oct', 'nov', 'dec'];

    function convertMonthName(expression, items){
        for(let i = 0; i < items.length; i++){
            expression = expression.replace(new RegExp(items[i], 'gi'), parseInt(i, 10) + 1);
        }
        return expression;
    }

    function interprete(monthExpression){
        monthExpression = convertMonthName(monthExpression, months);
        monthExpression = convertMonthName(monthExpression, shortMonths);
        return monthExpression;
    }

    return interprete;
})();
