let lastId = 404;
function onScanSuccess(decodedText, decodedResult) {
  // Handle on success condition with the decoded text or result.
  html5QrcodeScanner.pause();
  console.log(`Scan result: ${decodedText}`, decodedResult);
  let url = new URL(decodedText);
  let params = url.searchParams;
  let name = params.get('name') || 'no name';
  let id = params.get('id') || 404;
  console.log(`ID: ${id}, Name:${name}`);
  if (lastId == id && id != 404) {
    html5QrcodeScanner.resume();
  } else {
    lastId = id;
  }
}

let html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);