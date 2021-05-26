'use strict';

const path = require('path');
const egg = require('egg');
const eggUtils = require('egg-core').utils;
const graceful = require('graceful');
const grpc = require('@grpc/grpc-js');
const is = require('is-type-of');
const utility = require('utility');

const onFinished = require('on-finished');
const compose = require('koa-compose');

const EGG_PATH = Symbol.for('egg#eggPath');
const EGG_LOADER = Symbol.for('egg#loader');
const ROUTER = Symbol('EggCore#router');

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
    this.gRPCServer = null;
    this.gRPCServerCredentials = null;
    this.gRPCClientCredentials = grpc.credentials.createInsecure();

    // bind app's events
    this.once('server', httpServer => this.onGrpcServer(httpServer));
  }

  get [EGG_LOADER]() {
    return AppWorkerLoader;
  }

  get [EGG_PATH]() {
    return path.dirname(__dirname);
  }

  onGrpcServer(httpServer) {

    const config = this.config.gRPC || {};
    if (config.listen === false || !this.proto) return;

    const frameworkPath = this.options.framework;
    const frameworkPkg = utility.readJSONSync(path.join(frameworkPath, 'package.json'));

    const startTime = Date.now();
    const stickyMsg = this.options.sticky ? ' with STICKY MODE!' : '';

    // config.gRPCServerOptions: https://grpc.github.io/grpc/core/group__grpc__arg__keys.html
    const server = new grpc.Server(config.gRPCServerOptions);
    this.gRPCServer = server;
    this.gRPCServerCredentials = grpc.ServerCredentials.createInsecure();

    // 加载服务接口，绑定执行函数
    for (const name in this.proto) {
      const serviceDefinition = this.proto[name];
      for (const [key, value] of Object.entries(serviceDefinition)) {
        if (is.function(value)) {
          const handler = {};
          Object.keys(value.service).forEach(method => handler[method] = this.gRPCCallback());
          server.addService(value.service, handler); // 绑定处理方法
          // for (const [k, v] of Object.entries(value.service))
        }
      }
    }

    // 监听、启动
    const listenConfig = Object.assign({ hostname: '0.0.0.0', port: 50051 }, config.listen);
    server.bindAsync(`${listenConfig.hostname}:${listenConfig.port}`, this.gRPCServerCredentials, (error, port) => {
      if (error) this.emit('error', error);
      server.start();
      this.logger.info('[master] %s started on %s (%sms)%s',
        frameworkPkg.name, `grpc://${listenConfig.hostname}:${port}`, Date.now() - startTime, stickyMsg);
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

  gRPCCallback() {
    const fn = compose(this.middleware);
    // if (!this.listenerCount('error')) this.on('error', this.onerror);
    const handleRequest = (req, res) => {
      // console.log(req, res)
      const { metadata, request, call, } = req;

      let gRPCRequest = {
        method: 'RPC', protocol: 'grpc', type: call.handler.type,
        url: call.handler.path.toLowerCase(), path: call.handler.path,
        headers: JSON.stringify(metadata.get('headers').shift()),
      }

      const _gRPC = gRPCRequest.type === 'unary' && gRPCRequest.url === '/rpc/invoke';
      if (_gRPC) {
        Object.assign(gRPCRequest, { url: metadata.get('url').shift() });
      }

      const ctx = this.createAnonymousContext(gRPCRequest);
      ctx.call = req;
      ctx.callback = res;

      if (metadata.get('user').length) {
        ctx.user = JSON.parse(metadata.get('user').shift());
      }

      if (_gRPC) {
        try {
          ctx.request.body = JSON.parse(request.body.toString());
        } catch (error) {
          ctx.callback(error, null);
        }
      } else {
        ctx.request.body = request;
      }

      this.handlegRPCRequest(ctx, fn);
    };

    return handleRequest;
  }

  async handlegRPCRequest(ctx, fnMiddleware) {

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
    const methods = ['HEAD', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'RPC',]
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
