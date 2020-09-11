'use strict';

const path = require('path');
const fs = require('fs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

module.exports = class ProtoLoader {
  constructor(app, option) {
    console.log({ t: 'Proto', app, option });

    app.proto = {};

    const includeDirs = app.loader.getLoadUnits().map(unit => path.join(unit.path, 'app/proto'));

    const protoFiles = new Map();
    for (let dir of includeDirs) {
      if (fs.existsSync(dir)) {
        const ext = '.proto';
        fs.readdirSync(dir).filter(file => path.extname(file) === ext).forEach(file => {
          protoFiles.set(path.basename(file, ext), path.join(dir, file)) // ? 同名文件是否覆盖
        });
      }
    }
    this.console.log(protoFiles);

    for (const [ name, file ] of protoFiles) {
      const packageDefinition = protoLoader.loadSync(file, {
        keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
      });
      app.proto[name] = packageDefinition;
    }


    // app.loader.loadToApp(controllerBase, 'controller', opt);
    // const serviceDefinition = grpc.loadPackageDefinition(packageDefinition);
    // console.log({ packageDefinition, serviceDefinition })
  }

  test(m) {
    console.log({ m });
  }
}