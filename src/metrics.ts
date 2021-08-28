import ua from 'universal-analytics';

const metrics : ua.Visitor = ua('UA-181859507-1');

export const options = {
    disabled: false,
}

export function event(
    category: string,
    action: string,
    label?: string,
    value?: string | number,
    params?: ua.EventParams,
    callback?: ua.Callback,
): void {
    if(options.disabled) {
        console.log('No metric');
        return;
    }

    if(label && value && params) {
        metrics.event(category, action, label, value, params, callback).send();
    }
    else if(params) {
        metrics.event(params, callback).send();
    }
    else {
        metrics.event(category, action, callback).send();
    }
}