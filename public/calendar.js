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
    let resEvent = await GET('/userEvents?businessId=' + business.id);
    events = await resEvent.json();
    console.log(events);
    events.forEach(event => {
        console.log(event);
        const date = new Date(event.starttimestamp*1000);
        const endDate = new Date(event.endtimestamp*1000);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        let starttime = 0;
        let endtime = 0;
        if (date.getMinutes() < 10) {
            starttime = date.getHours() + ":0" + date.getMinutes(); 
        } else {
            starttime = date.getHours() + ":" + date.getMinutes(); 
        }
        if (endDate.getMinutes() < 10) {
            endtime = endDate.getHours() + ":0" + endDate.getMinutes();
        } else {
            endtime = endDate.getHours() + ":" + endDate.getMinutes();
        }
        let eventColor = colors[i%colors.length];
        $("#calendar").evoCalendar('addCalendarEvent', [
            {
              id: event.id,
              name: event.name,
              date: month+"/"+day+"/"+year,
              badge: starttime + "-" + endtime,
              color: eventColor,
              description: event.description,
              everyYear: false
            }
          ]);
    });
}