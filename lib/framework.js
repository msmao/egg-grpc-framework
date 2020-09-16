'use strict';

const path = require('path');
const egg = require('egg');
const eggUtils = require('egg-core').utils;
const graceful = require('graceful');
const grpc = require('@grpc/grpc-js');
const is = require('is-type-of');
const http = require('http');

const onFinished = require('on-finished');
const compose = require('koa-compose');

const EGG_PATH = Symbol.for('egg#eggPath');
const EGG_LOADER = Symbol.for('egg#loader');
const ROUTER = Symbol('EggCore#router');
const BIND_EVENTS = Symbol('Application#bindEvents');
const GRPC_RESPONSE_RAW = Symbol('Application#responseRaw');

const Router = require('./grpc_router');
const AppWorkerLoader = require('./grpc_loader');

class Application extends egg.Application {

  /**
 * @class
 * @param {Object} options - see {@link EggApplication}
 */
  constructor(options = {}) {
    super(options);

    // will auto set after 'server' event emit
    this.grpcServer = null;
    this.grpcServerCredentials = null;
    this.grpcClientCredentials = null;

    // bind app's events
    this.once('server', httpServer => this.onGrpcServer(httpServer));
  }

  get [EGG_LOADER]() {
    return AppWorkerLoader;
  }

  get [EGG_PATH]() {
    return path.dirname(__dirname);
  }

  onGrpcServer(server) {

    if (!this.proto) return;

    server = new grpc.Server(); // 用 grpcServer 替换 httpServer
    this.grpcServer = server;
    this.grpcServerCredentials = grpc.ServerCredentials.createInsecure();
    this.grpcClientCredentials = grpc.credentials.createInsecure();
    
    // 加载服务接口，绑定执行函数
    for (const name in this.proto) {
      const serviceDefinition = this.proto[name];
      for (const [key, value] of Object.entries(serviceDefinition)) {
        if (is.function(value)) {
          const handler = {};
          Object.keys(value.service).forEach(method => handler[method] = this.callback());
          server.addService(value.service, handler); // 绑定处理方法
          // for (const [k, v] of Object.entries(value.service))
        }
      }
    }

    // 监听、启动
    server.bindAsync('0.0.0.0:50051', this.grpcServerCredentials, (error, port) => {
      if (error) this.emit('error', error);
      server.start();
      this.logger.info(`[master] @obelisk/egg started on grpc://0.0.0.0:${port}`);
    });

    /* istanbul ignore next */
    graceful({
      server: [server],
      error: (err, throwErrorCount) => {
        const originMessage = err.message;
        if (originMessage) {
          // shouldjs will override error property but only getter
          // https://github.com/shouldjs/should.js/blob/889e22ebf19a06bc2747d24cf34b25cc00b37464/lib/assertion-error.js#L26
          Object.defineProperty(err, 'message', {
            get() {
              return originMessage + ' (uncaughtException throw ' + throwErrorCount + ' times on pid:' + process.pid + ')';
            },
            configurable: true,
            enumerable: false,
          });
        }
        this.coreLogger.error(err);
      },
    });

    // server.on('clientError', (err, socket) => this.onGrpcClientError(err, socket));

    // server timeout
    // if (is.number(this.config.serverTimeout)) server.setTimeout(this.config.serverTimeout);
  }

  callback() {
    const fn = compose(this.middleware);
    // if (!this.listenerCount('error')) this.on('error', this.onerror);
    const handleRequest = (req, res) => {
      // console.log(req, res)
      const request = req.request;
      const handler = req.call.handler;
      const url = String(handler.path).toLowerCase();

      let RpcRequest = {
        method: 'RPC', protocol: 'grpc', type: handler.type, url, path: handler.path,
        //  url: `/__schedule?path=${key}&${qs.stringify(schedule.schedule)}`,
      }

      const isDefaultRpc = handler.type === 'unary' && url === '/rpc/invoke';
      if (isDefaultRpc) {
        Object.assign(RpcRequest, { url: '/' + request.method.split('.').join('/') });
      }
      console.log({ handler, request, RpcRequest });

      const ctx = this.createAnonymousContext(RpcRequest);
      ctx.call = req;
      ctx.callback = res;

      if (isDefaultRpc) {
        ctx.request.body = JSON.parse(request.params.toString());
      } else {
        ctx.request.body = request;
      }
      console.log({
        url: ctx.url,
        path: ctx.path,
        hpath: handler.path,
      })
      this.handleRequest(ctx, fn);
    };

    return handleRequest;
  }

  async handleRequest(ctx, fnMiddleware) {

    try {
      await fnMiddleware(ctx); // 执行逻辑
    } catch (error) {
      ctx.callback(error, null);
    }

    if (ctx.method === 'RPC' && ctx.call.call.handler.path === '/rpc/invoke') {
      const body = typeof ctx.body === 'string' ? ctx.body : JSON.stringify(ctx.body);
      ctx.callback(null, { body: Buffer.from(body) })
    } else {
      ctx.callback(null, ctx.body)
    }

    // this.emit('request', ctx);
    // onFinished(ctx.res, () => this.emit('response', ctx));
    // return super.handleRequest(ctx, fnMiddleware);
  }

  /**
   * get router
   * @member {Router} EggCore#router
   * @since 1.0.0
   */
  get router() {
    if (this[ROUTER]) {
      return this[ROUTER];
    }
    const methods = [ 'HEAD', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'RPC', ]
    const router = this[ROUTER] = new Router({ sensitive: true, methods }, this);
    // register router middleware
    this.beforeStart(() => {
      this.use(router.middleware());
    });
    return router;
  }
}

class Agent extends egg.Agent {
  get [EGG_PATH]() {
    return path.dirname(__dirname);
  }
}

//将 router 上所有的 method 函数代理到 EggCore 上，这样我们就可以通过 app.get('/async', ...asyncMiddlewares, 'subController.subHome.async1') 的方式配置路由
// delegate all router method to application
eggUtils.methods.concat(['rpc', 'all', 'resources', 'register', 'redirect']).forEach(method => {
  Application.prototype[method] = function (...args) {
    console.log({ method, args });
    this.router[method](...args);
    return this;
  };
});

module.exports = Object.assign(egg, {
  AppWorkerLoader,
  Application,
  Agent,
});
