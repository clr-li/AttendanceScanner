function onScanSuccess(decodedText, decodedResult) {
  // Handle on success condition with the decoded text or result.
  html5QrcodeScanner.pause();
  console.log(`Scan result: ${decodedText}`, decodedResult);
  let url = new URL(window.location);
  let params = url.searchParams;
  let eventid = params.get('eventid');
  fetch(`/makeRecord?eventid=${eventid}&userid=${decodedText}&id=0`).then((res) => { console.log(res.status) });
  html5QrcodeScanner.resume();
}

let html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);