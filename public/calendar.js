import { GET, POST } from './util/Client.js';

let resBusiness = await GET('/businesses');
let o = await resBusiness.json();
let businesses = [];
o.forEach(business => {
    if (business.role != 'user') {
        businesses.push(business);
    }
});
let events;
businesses.forEach(async business => {
    let resEvent = await GET('/events?businessId=' + business.id);
    events = await resEvent.json();
    console.log(events);
    events.forEach(event => {
        let date = new Date(event.starttimestamp*1000);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        let month = months[date.getMonth()];
        let day = date.getDate();
        let year = date.getFullYear();
        console.log(date + " mdy " + month + " " + day + " " + year);
        $("#calendar").evoCalendar('addCalendarEvent', [
            {
              id: event.id,
              name: event.name,
              date: month+"/"+day+"/"+year,
              description: event.description,
              everyYear: false
            }
          ]);
    });
});

$("#calendar").evoCalendar();