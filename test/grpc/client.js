'ues strict';

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');


const packageDefinition = protoLoader.loadSync(`default.proto`, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  includeDirs: [path.join(__dirname, 'proto')],
});
const serviceDefinition = grpc.loadPackageDefinition(packageDefinition);

(async () => {
  const client = new serviceDefinition.rpc('localhost:50051', grpc.credentials.createInsecure());
  
  const data = { sf: 'a23' }
  const body = Buffer.from(JSON.stringify(data));

  client.invoke({ body }, (error, response) => {
    if (error) throw error;
    console.log(response.body.toString());
    // let res = JSON.parse(response.body.toString());
    // console.log({ res })
  })
})();