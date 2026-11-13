const convert = (() => {
    const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
        'friday', 'saturday'];
    const shortWeekDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    function convertWeekDayName(expression: string, items: string[]){
        for(let i = 0; i < items.length; i++){
            expression = expression.replace(new RegExp(items[i], 'gi'), String(i));
        }
        return expression;
    }
  
    function convertWeekDays(expression: string){
        expression = expression.replace('7', '0');
        expression = convertWeekDayName(expression, weekDays);
        return convertWeekDayName(expression, shortWeekDays);
    }

    return convertWeekDays;
})();

export = convert;
