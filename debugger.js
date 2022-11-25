var child_process = require('child_process')
var http = require('http')

var HttpProxy = require('http-proxy')

var childEnv = JSON.parse(JSON.stringify(process.env));
childEnv.PORT = 1988;

var child = child_process.spawn("node", ["--inspect=localhost:9200", "server.js"], { env: childEnv })
child.stdout.on('data', (data) => {
  console.log(`${data}`)
})

var currentDebuggerPath = null;

child.stderr.on('data', (data) => {
  data = data.toString()
  if (data.indexOf("chrome-devtools://") >= 0) {
    currentDebuggerPath = data.substring(data.lastIndexOf('/'))
    data = data.replace(`127.0.0.1:9200${currentDebuggerPath}`, `${process.env.PROJECT_NAME}.glitch.me:80`)
    console.log(`\n\n${data}\n\n`)
    return
  }
  console.error(data)
})

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`)
})

var proxyToDebugger = new HttpProxy.createProxyServer({
  target: {
    host: 'localhost',
    port: 9200
  }
})

var proxyToApp = new HttpProxy.createProxyServer({
  target: {
    host: 'localhost',
    port: 1988
  }
})

var proxyServer = http.createServer(function (req, res) {
  console.log('http', req.url)
  if (req.headers.origin === "chrome-devtools://devtools") {
    req.url = currentDebuggerPath;
    proxyToDebugger.web(req, res)
  } else {
    proxyToApp.web(req, res)
  }
})

proxyServer.on('upgrade', function (req, socket, head) {
  console.log('upgrade', req.url)
  if (req.headers.origin === "chrome-devtools://devtools") {
    req.url = currentDebuggerPath
    proxyToDebugger.ws(req, socket, head)
  } else {
    proxyToApp.ws(req, socket, head)
  }
})

proxyServer.listen(3000)