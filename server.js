const express = require('express');
const app = express();
var expressWs = require('express-ws')(app);
const pty = require('node-pty');
const argv = require('yargs').argv;
const {JSONPath} = require('jsonpath-plus');
const fs = require("fs");

const jsonPathLocators = "$.p-cloudcache[0].credentials.locators[0]";
const jsonPathPassword = "$.p-cloudcache[0].credentials.users[?(@.roles[0] == 'cluster_operator')].password";
const jsonPathUsername = "$.p-cloudcache[0].credentials.users[?(@.roles[0] == 'cluster_operator')].username";
const allowed_addresses = JSON.parse(process.env.allowed_addresses || "[]");

var terminals = {};
var logs = {};


app.use(express.static('static'));
app.use(express.static('node_modules/xterm/dist'));
app.use(express.static('node_modules/core-js-bundle'));
app.use(express.static('node_modules/jsonpath-plus'));
app.enable('trust proxy');

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');

  if (!(allowed_addresses.indexOf(req.ip) >= 0)) {
    res.status(403);
    res.send('Not Allowed - check Allowed Orgins list');
    res.end();
    return;
  }
  next();
});


app.post('/terminals', function (req, res) {
  let term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols:  80,
    rows:  24,
    cwd: process.env.PWD,
    env: process.env
  });

  console.log('Created terminal with PID: ' + term.pid);
  terminals[term.pid] = term;
  logs[term.pid] = '';
  term.on('data', function (data) {
    logs[term.pid] += data;
  });
  if(process.platform !== "darwin"){
    if(!fs.existsSync("jdk8u212-b04")){
      term.write("wget https://gemfire-field.s3.amazonaws.com/OpenJDK8U-jdk_x64_linux_hotspot_8u212b04.tar.gz\r");
      term.write("tar zxf OpenJDK8U-jdk_x64_linux_hotspot_8u212b04.tar.gz\r");
      term.write("wget https://gemfire-field.s3.amazonaws.com/pivotal-gemfire-9.8.3.tgz\r");
      term.write("tar zxf pivotal-gemfire-9.8.3.tgz\r");
      term.write("rm -f pivotal-gemfire-9.8.3.tgz\r");
      term.write("rm -f OpenJDK8U-jdk_x64_linux_hotspot_8u212b04.tar.gz\r");
    }
    term.write("export JAVA_HOME=`pwd`/jdk8u212-b04\r");
  }
  term.write("pivotal-gemfire-9.8.3/bin/gfsh\r");
  locator = JSON.stringify(JSONPath({path:jsonPathLocators, json: JSON.parse(process.env.VCAP_SERVICES)})[0]);
  user = JSON.stringify(JSONPath({path:jsonPathUsername, json: JSON.parse(process.env.VCAP_SERVICES)}));
  password = JSON.stringify(JSONPath({path:jsonPathPassword, json: JSON.parse(process.env.VCAP_SERVICES)}));
  gemfireConnectString = "connect --locator= " + locator + " --user=" + user + " --password=" + password + "\r";
  res.send(term.pid.toString());
  res.end();
});

app.ws('/terminals/:pid', function (ws, req) {
  var term = terminals[parseInt(req.params.pid, 10)];
  if (!term) {
    ws.send('No such terminal created.');
    return;
  }
  ws.send(logs[term.pid]);

  onDataFunction = (function (data) {
    var firstTime = true;
    var input = "";
    return function(data){
      input += data;
      if(firstTime && (input.includes( "gfsh>"))){
        firstTime = false;
        input = "";
        locator = JSONPath({path:jsonPathLocators, json: JSON.parse(process.env.VCAP_SERVICES)})[0];
        user = JSONPath({path:jsonPathUsername, json: JSON.parse(process.env.VCAP_SERVICES)})[0];
        password = JSONPath({path:jsonPathPassword, json: JSON.parse(process.env.VCAP_SERVICES)})[0];
        gemfireConnectString = "connect --locator= " + locator + " --user=" + user + " --password=" + password + "\r";
        term.write(gemfireConnectString);
      }
      try {
        ws.send(data);
      } catch (ex) {
        // The WebSocket is not open, ignore
      }
    }
  })();

  term.on('data', onDataFunction);

  ws.on('message', function (msg) {
    term.write(msg);
  });
  
  ws.on('close', function () {
    term.kill();
    console.log('Closed terminal ' + term.pid);
    // Clean things up
    delete terminals[term.pid];
    delete logs[term.pid];
  });
});

app.listen(process.env.PORT || 9090);
