'use strict';

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const is = require('is-type-of');

module.exports = {
  loadProtoBuf(opt) {
    this.timing.start('Load ProtoBuf');

    const protoLoaderConfig = this.app.config.protoLoader || {};
    protoLoaderConfig.options = Object.assign({
      keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
    }, protoLoaderConfig.options);

    // load proto to app.proto
    opt = Object.assign({
      call: false,
      override: true,
      caseStyle: 'lower',
      match: '**/*.proto',
      fieldClass: 'grpcClasses',
      directory: this.getLoadUnits().map(unit => path.join(unit.path, 'app/proto')),
      initializer(proto, meta) {
        const _proto = {};
        // console.log('loading protobuf: %s', meta.path, proto.toString());
        const packageDefinition = protoLoader.loadSync(meta.path, protoLoaderConfig.options);
        const protobuf = grpc.loadPackageDefinition(packageDefinition);
        for (const key in protobuf) {
          if (is.function(protobuf[key])) _proto[key] = protobuf[key];
        }
        return _proto;
      },
    }, opt);
    const protobufPaths = opt.directory;
    this.loadToApp(protobufPaths, 'proto', opt);

    this.options.logger.info('[egg:loader] Loaded protobuf from %j', protobufPaths);
    this.timing.end('Load ProtoBuf');
  }
};