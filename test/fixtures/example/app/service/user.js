'use strict';

const Service = require('egg').Service;

class UserService extends Service {

  async login() {
    // ...
    return { state: 'ok' };
  }

}

module.exports = UserService;
