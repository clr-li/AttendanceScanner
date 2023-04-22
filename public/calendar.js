import { GET, POST } from './util/Client.js';

$("#calendar").evoCalendar();
let resBusiness = await GET('/businesses');
let o = await resBusiness.json();
let businesses = [];
o.forEach(business => {
    businesses.push(business);
});
let events;
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const colors = ["blue", "red", "purple", "green", "orange", "hotpink", "yellow", "turquoise", "indigo", "maroon", "lime"];
for (const [i, business] of Object.entries(businesses)) {
    let resEvent = await GET('/events?businessId=' + business.id);
    events = await resEvent.json();
    events.forEach(event => {
        let date = new Date(event.starttimestamp*1000);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        let month = months[date.getMonth()];
        let day = date.getDate();
        let year = date.getFullYear();
        let eventColor = colors[i%colors.length];
        $("#calendar").evoCalendar('addCalendarEvent', [
            {
              id: event.id,
              name: event.name,
              date: month+"/"+day+"/"+year,
              color: eventColor,
              description: event.description,
              everyYear: false
            }
          ]);
    });
}