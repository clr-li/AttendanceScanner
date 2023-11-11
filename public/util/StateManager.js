const urlParams = new URLSearchParams(window.location.search);
/**
 * 
 * @param {string} paramName 
 * @returns 
 */
export function useURL(paramName, defaultValue) {
    const stateObject = { 
        get: () => urlParams.get(paramName) || defaultValue, 
        set: (val) => {
            urlParams.set(paramName, val); 
            window.history.replaceState({}, '', `${location.pathname}?${urlParams.toString()}`); 
        }
    };
    stateObject[paramName] = urlParams.get(paramName) || defaultValue
    return stateObject;
}