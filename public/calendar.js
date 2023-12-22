import { GET } from './util/Client.js';
import { requireLogin } from './util/Auth.js';
import { sanitizeText } from './util/util.js';
import { Popup } from './components/Popup.js';
await requireLogin();

$("#calendar").evoCalendar();

const colors = ["blue", "red", "purple", "green", "orange", "hotpink", "yellow", "turquoise", "indigo", "maroon", "lime"];

const resBusiness = await GET('/businesses');
const businesses = await resBusiness.json();

const sidebar = document.getElementsByClassName("calendar-events");

const quickEventBtn = document.createElement("a");
quickEventBtn.href = "/scanner.html#new";
quickEventBtn.textContent = "Create Quick Event Now";
quickEventBtn.className = "button";
quickEventBtn.style = "text-align: center; display: block; margin: 1rem auto;";
sidebar[0].appendChild(quickEventBtn);

sidebar[0].innerHTML += /* html */`
    ${businesses.map((business, i) => /* html */`
        <p aria-role="presentation" style="color: ${colors[i%colors.length]}; display: inline; font-size: 1.2rem; margin-left: 1.5rem;" id="${sanitizeText(business.id)}">&#9632;</p>
        <p style="display: inline; font-size: 1.2rem;">${sanitizeText(business.name)}</p>
    `).join('<br>')}
`;

for (const [i, business] of Object.entries(businesses)) {
    const businessColor = colors[i%colors.length];
    const resEvent = await GET('/userEvents?businessId=' + business.id);
    const events = await resEvent.json();
    events.sort((a, b) => {
        return a.starttimestamp - b.starttimestamp;
    });
    for (const event of events) {
        const startDate = new Date(event.starttimestamp*1000);
        const endDate = new Date(event.endtimestamp*1000);
        const status = event.status ?? (Date.now() > endDate.getTime() ? "ABSENT" : null);
        let edit = '<br>';
        const starttime = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        const endtime = endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        if (status == null) {
            edit += `<button id="event-btn" style="color: inherit; background-color: transparent; border: none; font-size: 0.8em; cursor: pointer;" onclick="markAbsent('${sanitizeText(business.id)}', '${sanitizeText(event.id)}')">I'll be absent <i class="icon-tombstone descender"></i></i></button>&nbsp;&nbsp;&nbsp;`;
        }
        if (business.role == 'owner' || business.role == 'admin' || business.role == 'moderator') {
            edit += `<a style="color: inherit; text-decoration: none; font-size: 0.8em;" href="/admin.html?eventId=${sanitizeText(event.id)}&businessId=${sanitizeText(business.id)}">Edit <i class="fa-regular fa-pen-to-square" title="Edit Event"></i></a>&nbsp;&nbsp;&nbsp;`;
        }
        if (business.role == 'scanner' || business.role == 'admin' || business.role == 'owner') {
            edit += `<a style="color: inherit; text-decoration: none; font-size: 0.8em;" href="/scanner.html?eventId=${sanitizeText(event.id)}&businessId=${sanitizeText(business.id)}">Scanner <i class="icon-scanner descender" title="Take Attendance"></i></a>`;
        }
        const eventData = {
            id: sanitizeText(event.id),
            name: sanitizeText(starttime) + " - " + sanitizeText(endtime),
            date: `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear()}`,
            badge: sanitizeText(status),
            color: businessColor,
            description: '<h3 style="margin-top:0.1em;margin-bottom:0.5em;">' + sanitizeText(event.name) + "</h3>" + "Event Description: " + sanitizeText(event.description) + edit,
            everyYear: false,
        }
        $("#calendar").evoCalendar('addCalendarEvent', eventData);
    }
}

window.markAbsent = async (businessId, eventId) => {
    const res = await GET(`/markSelfAbsent?businessId=${businessId}&eventId=${eventId}`);
    if (!res.ok) {
        await Popup.alert(await res.text(), "var(--error)");
        return;
    }
    await Popup.alert('You have been marked absent!');

    // manually change html since evo-calendar is broken when adding and removing events
    const badge = document.createElement("span");
    badge.textContent = "ABSENT(self-marked)";
    document.querySelector(`[data-event-index="${eventId}"]`).getElementsByClassName("event-title")[0].appendChild(badge);
}

// smooth load (keep previous page visible until content loaded)
// requires the body to start with opacity: 0, and this should be the last script run.
// don't forget the no-script fallback
setTimeout(() => {
    document.body.style.opacity = '1';
}, 200);