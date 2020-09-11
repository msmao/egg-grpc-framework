'use strict';

const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const is = require('is-type-of');
const traverse = require('traverse');

module.exports = {

  loadProtoBuf(opt) {
    this.timing.start('Load ProtoBuf');
    const app = this.app;

    const config = app.config.grpc || {};
    config.loadOpts = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true };

    // this.app.proto = {};
    // const includeDirs = this.getLoadUnits().map(unit => path.join(unit.path, 'app/proto'));
    // const protoFiles = new Map();
    // for (let dir of includeDirs) {
    //   if (fs.existsSync(dir)) {
    //     const ext = '.proto';
    //     fs.readdirSync(dir).filter(file => path.extname(file) === ext).forEach(file => {
    //       protoFiles.set(path.basename(file, ext), path.join(dir, file)) // ? 同名文件是否覆盖
    //     });
    //   }
    // }
    // for (const [name, file] of protoFiles) {
    //   const packageDefinition = protoLoader.loadSync(file, {
    //     keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
    //   });
    //   this.app.proto[name] = packageDefinition;
    // }

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
        const packageDefinition = protoLoader.loadSync(meta.path, config.loadOpts);
        const protobuf = grpc.loadPackageDefinition(packageDefinition);
        for (const key in protobuf) {
          if (is.function(protobuf[key])) _proto[key] = protobuf[key];
        }
        return _proto;
      },
    }, opt);
    const protobufPaths = opt.directory;
    this.loadToApp(protobufPaths, 'proto', opt);

    // for (const name in app.proto) {
    //   // console.log(name, app.proto[name])
    //   const protobuf = app.proto[name];
    //   const proto = {
    //     // origin: protobuf,
    //   }
    //   for (const key in protobuf) {
    //     if (protobuf.hasOwnProperty(key) && is.function(protobuf[key])) {
    //       proto[key] = protobuf[key];
    //     }
    //   }
    //   Object.defineProperty(app.proto, name, {
    //     get() {
    //       return proto;
    //     },
    //     enumerable: false,
    //     configurable: false,
    //   });
    // }

    // console.log(app.proto);

    // 载入到 app.serviceClasses
    // opt = Object.assign({
    //   call: true,
    //   caseStyle: 'lower',
    //   fieldClass: 'serviceClasses',
    //   directory: this.getLoadUnits().map(unit => path.join(unit.path, 'app/service')),
    // }, opt);
    // const servicePaths = opt.directory;
    // this.loadToContext(servicePaths, 'service', opt);

    this.options.logger.info('[egg:loader] Loaded protobuf from %j', protobufPaths);
    this.timing.end('Load ProtoBuf');
  }
};