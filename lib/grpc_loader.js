'use strict';

const egg = require('egg');

class AppWorkerLoader extends egg.AppWorkerLoader {
  constructor(opt) {
    super(opt);
  }

  loadConfig() {
    super.loadConfig();
  }

  load() {
    super.load();
    this.loadProtoBuf();
  }
}

Object.assign(AppWorkerLoader.prototype, require('./proto_loader'));

module.exports = AppWorkerLoader;