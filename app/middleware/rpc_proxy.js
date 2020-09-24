'use strict';

const grpc = require('@grpc/grpc-js');

module.exports = () => {
  return async (ctx, next) => {
    ctx.rpc = new Proxy(() => { }, {
      get: (target, key) => {
        const service = !target.args || !target.args.length || key.lastIndexOf('Service') > 0;
        service ? target.args = [key] : target.args.push(key);
        // console.log('get:', target, key)
        return ctx.rpc;
      },
      apply: async (target, that, args) => {
        // console.log('apply:', { target, that, args })
        const proto = 'default'; // target.args[0] // 暂时只支持 default protobuf
        const client = ctx.grpc(target.args);

        const metadata = new grpc.Metadata();
        metadata.set('url', '/' + target.args.join('/'));
        if (ctx.headers) metadata.set('headers', JSON.stringify(ctx.headers));
        if (ctx.user) metadata.set('user', JSON.stringify(ctx.user));
        const options = undefined;

        // const context = Buffer.from(JSON.stringify(ctx.user ? ctx.user : {}))
        const invoke = proto === 'default' ? 'invoke' : target.args.pop();
        const data = proto === 'default' ? { body: Buffer.from(JSON.stringify(args.shift())), } : args.shift();

        return new Promise((resolve, reject) => {
          const callback = (error, response) => {
            if (error) return reject(error);
            if (!response.body) return resolve(response);
            const body = Buffer.isBuffer(response.body) ? response.body.toString() : response.body;
            try {
              return resolve(JSON.parse(body));
            } catch (e) {
              return reject(e);
            }
          };
          client[invoke].call(client, data, metadata, callback);
        })
      }
    })
    await next();
  }
};
