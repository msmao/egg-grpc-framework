'use strict';

const Controller = require('@obelisk/egg').Controller;

const grpc = require('@grpc/grpc-js');

class HomeController extends Controller {
  
  async index() {
    const { ctx, app } = this;
    console.log(app.proto)
    ctx.body = 'hi, egg';
  }

  async test() {
    const { ctx, app } = this;
    // ctx.grpc.[service].[controller].[method](data, mate, options)
    // const result = await ctx.grpc.default.rpc.test({ message: 'hi' });
    ctx.body = { message: 'test' };
  }

  async rpc() {
    const { ctx, app } = this;
    // console.log(ctx);
    console.log({
      body: ctx.request.body,
      url: ctx.url,
      // path: ctx.path,
      // params: ctx.params,
      // query: ctx.query,
    })

    console.log(app.name);

    const result = await this.call('default.rpc.test', { hhh: 'aaa' });
    console.log('call:', result);


    ctx.body = { message: ['hi', 'rpc call'] };
  }

  call(method, params) {
    const endpoint = `127.0.0.1:50051`;
    const client = new this.app.proto.default.rpc(endpoint, this.app.grpcClientCredentials);
    const body = { body: Buffer.from(JSON.stringify(params)) };
    return new Promise((resolve, reject) => {
      const callback = (error, response) => {
        error ? reject(error) : resolve(response.body.toString());
      };
      client[method](body, callback);
    })
  }
}

module.exports = HomeController;
