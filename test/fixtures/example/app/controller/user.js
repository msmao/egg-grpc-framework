'use strict';

const Controller = require('egg').Controller;

class UserController extends Controller {

  async login() {
    const body = this.ctx.request.body;
    const result = await this.service.user.login(body);
    this.ctx.body = result;
  }

  // test http method call rpc
  async test() {
    const params = this.ctx.query;
    const result = await this.ctx.rpc.userService.user.login(params);
    this.ctx.body = result;
  }

}

module.exports = UserController;
