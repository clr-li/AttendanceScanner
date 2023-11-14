import { GET } from './Client.js';
import { Popup } from '../components/Popup.js';
import { useURL } from './StateManager.js';

export async function initSelector(id, onselect, addOptions) {
    const selector = document.getElementById(id);
    const state = useURL(id);
    const { get, set } = state;
    selector.addEventListener("select", (e) => {
        set(e.detail.dataset.id);
        if (onselect) onselect(e);
    });
    const initResults = await addOptions(selector);
    function setter(value) {
        set(value);
        selector.setValue('data-id', value);
    }
    if (selector.firstElementChild) {
        setter(get() || selector.firstElementChild.dataset.id);
    }
    return {
        get: get,
        set: setter,
        initResults: initResults,
        selector: selector,
    };
}

export async function initBusinessSelector(id, onselect, require=true, roleFilter=(role) => role != "user") {
    const selectorResults = await initSelector(id, onselect, async (selector) => {
        const businessRes = await GET('/businesses');
        const businesses = await businessRes.json();
        let noBusinesses = true;
        businesses.forEach(business => {
            if (roleFilter(business.role)) {
                noBusinesses = false;
                selector.addOption(business.name, business.role, {"data-id": business.id});
            }
        });
        return noBusinesses;
    });
    const { initResults: noBusinesses} = selectorResults;
    if (noBusinesses && require) {
        document.body.style.opacity = '1';
        const shouldRedirect = await Popup.confirm("You own no groups. You'll be redirected to the start-a-group page");
        if (shouldRedirect) location.assign('/payment.html');
        else history.back();
    }
    return selectorResults;
}

export async function initEventSelector(id, getBusinessId, onselect, onupdate) {
    async function updateEvents(selector) {
        const res = await GET('/events?businessId=' + getBusinessId());
        const events = await res.json();
        const eventNames = new Set();
        const options = events.map(event => {
            const startDate = new Date(event.starttimestamp*1000);
            const endDate = new Date(event.endtimestamp*1000);
            eventNames.add(event.name);
            const option = document.createElement('option');
            option.value = event.name + " (" + event.id + ")";
            option.textContent = startDate.toDateString() + " to " + endDate.toDateString();
            option.setAttribute("data-id", event.id);
            return option;
        });
        selector.replaceChildren(...options);
        if (onupdate) onupdate(events, options, eventNames);
    }
    const selectorResults = await initSelector(id, onselect, async (selector) => {
        await updateEvents(selector);
        return selector.childElementCount == 0;
    });
    const { get: getEventId, set: setEventId, selector: eventSelector, initResults: noEvents} = selectorResults;
    return { ...selectorResults, updateEvents: async () => {
        await updateEvents(eventSelector);
        if (eventSelector.firstElementChild && !getEventId()) {
            setEventId(eventSelector.firstElementChild.dataset.id);
            if (onselect) onselect({ detail: eventSelector.firstElementChild });
        }
    }};
}