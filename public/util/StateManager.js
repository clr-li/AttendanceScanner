const urlParams = new URLSearchParams(window.location.search);
/**
 * Creates a state object for managing state in the url.
 * @param {string} paramName the name of the url parameter to get and set.
 * @returns {{ [paramName]: string, get: CallableFunction, set: CallableFunction}} an object with a get and set method that can be used to get and set the value of the url parameter.
 */
export function useURL(paramName, defaultValue) {
    const stateObject = { 
        get: () => urlParams.get(paramName) || defaultValue, 
        set: (val) => {
            if (val === defaultValue) urlParams.delete(paramName);
            else urlParams.set(paramName, val); 
            window.history.replaceState({}, '', `${location.pathname}?${urlParams.toString()}`); 
        }
    };
    stateObject[paramName] = urlParams.get(paramName) || defaultValue
    return stateObject;
}