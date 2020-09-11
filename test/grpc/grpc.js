'use strict';


const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const is = require('is-type-of');

const call = (call, callback) => {
  let json = JSON.parse(call.request.body.toString());
  console.log({ json })
  callback(null, { body: Buffer.from(JSON.stringify({ json })) })
  // console.log({ action: 'client.reqRes', data: call.request });
  // callback(null, { message: 'ok' });
  // callback(new Error('mmmsaf'), null)
}

const server = new grpc.Server();

const packageDefinition = protoLoader.loadSync(`default.proto`, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  includeDirs: [path.join(__dirname, 'proto')],
});
const serviceDefinition = grpc.loadPackageDefinition(packageDefinition); // .filter(def => is.function(def));

const serviceMap = new Map();
for (const [key, value] of Object.entries(serviceDefinition)) {
  if (is.function(value)) {
    const handler = {};
    Object.keys(value.service).forEach(key => handler[key] = call);
    server.addService(value.service, handler);
    // for (const [k, v] of Object.entries(value.service))
    // serviceMap.set(key, value);
  }
}

const creds = grpc.ServerCredentials.createInsecure();
server.bindAsync('0.0.0.0:50051', creds, (err, port) => {
  if (err) throw err;
  server.start();
  console.log(`0.0.0.0:${port}`);
});
