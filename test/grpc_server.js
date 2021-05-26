'use strict';


const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');


const server = new grpc.Server();

const packageDefinition = protoLoader.loadSync(`rpc.proto`, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  includeDirs: [path.join(__dirname, 'proto')],
});
const serviceDefinition = grpc.loadPackageDefinition(packageDefinition);

const call = (call, callback) => {
  let json = JSON.parse(call.request.stream.toString());
  console.log({ json })
  callback(null, { stream: Buffer.from(JSON.stringify({ json })) })
  // console.log({ action: 'client.reqRes', data: call.request });
  // callback(null, { message: 'ok' });
}

server.addService(serviceDefinition.RpcService.service, { call });
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) throw err;
  server.start();
  console.log(`0.0.0.0:${port}`);
});