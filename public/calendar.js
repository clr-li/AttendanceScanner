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
    events.forEach(event => {
        const date = new Date(event.starttimestamp*1000);
        const endDate = new Date(event.endtimestamp*1000);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        let starttime = 0;
        let endtime = 0;
        let status = event.status;
        if (date.getMinutes() < 10)
            starttime = date.getHours() + ":0" + date.getMinutes(); 
        else
            starttime = date.getHours() + ":" + date.getMinutes(); 
        if (endDate.getMinutes() < 10)
            endtime = endDate.getHours() + ":0" + endDate.getMinutes();
        else
            endtime = endDate.getHours() + ":" + endDate.getMinutes();
        let eventColor = colors[i%colors.length];
        if (event.status == null && Date.now() > event.endtimestamp * 1000) {
            status = "ABSENT";
        }
        $("#calendar").evoCalendar('addCalendarEvent', [
            {
              id: event.id,
              name: starttime + "-" + endtime,
              date: month+"/"+day+"/"+year,
              badge: status,
              color: eventColor,
              description: '<h3 style="margin-top:0.1em;margin-bottom:0.5em;">' + event.name + "</h3>" + "Event Description: " + event.description,
              everyYear: false
            }
          ]);
    });
}