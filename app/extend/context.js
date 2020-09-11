'use strict';


const CONTEXT_GRPCCLIENT = Symbol('Context#grpcclient');

module.exports = {

  get grpc() {
    if (!this[CONTEXT_GRPCCLIENT]) {
      this[CONTEXT_GRPCCLIENT] = {}; // new this.app.ContextHttpClient(this);
      // 根据 protobuf 构建对应的 grpc client
    }
    return this[CONTEXT_GRPCCLIENT];
  },

  rpc() {
    return this.grpc;
  }

};
