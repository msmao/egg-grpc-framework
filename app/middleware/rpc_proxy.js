'use strict';

module.exports = () => {
  return async (ctx, next) => {
    ctx.rpc = new Proxy(() => {}, {
      get: (target, key) => {
        !target.args || !target.args.length ? target.args = [key] : target.args.push(key)
        // console.log('get:', target, key)
        return ctx.rpc;
      },
      apply: async (target, that, args) => {
        // console.log('apply:', { target, that, args })
        const proto = target.args[0]
        const client = ctx.grpc(target.args);
        
        const invoke = proto === 'default' ? 'invoke' : target.args.pop();
        const data = proto === 'default' ? { method: target.args.join('.'), params: Buffer.from(JSON.stringify(args.shift())) }: args.shift();

        return new Promise((resolve, reject) => {
          const callback = (error, response) => {
            if (error) reject(error);
            response.body ? resolve(JSON.parse(response.body.toString())) : resolve(response)
          };
          client[invoke].call(client, data, callback);
        })
      }
    })
    await next();
  }
};
