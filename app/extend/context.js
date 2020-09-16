'use strict';


const CONTEXT_GRPCCLIENT = Symbol('Context#grpcclient');

module.exports = {

  // get grpc() {
  //   if (!this[CONTEXT_GRPCCLIENT]) {
  //     this[CONTEXT_GRPCCLIENT] = {}; // new this.app.ContextHttpClient(this);
  //     // 根据 protobuf 构建对应的 grpc client
  //   }
  //   return this[CONTEXT_GRPCCLIENT];
  // },

  grpc(args) {
    const dns = this.helper.dns(args.shift());
    // const method = args.pop();
    console.log(Object.assign(dns, { args }));
    return new this.app.proto.echo.Echo(dns.endpoint, this.app.grpcClientCredentials);
    // return new this.app.proto.default.rpc(dns.endpoint, this.app.grpcClientCredentials);
  }

};
