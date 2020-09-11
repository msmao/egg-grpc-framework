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

const rpc = function (name, path /* , middleware */) {
  let middleware;

  if (typeof path === 'string' || path instanceof RegExp) {
    middleware = Array.prototype.slice.call(arguments, 2);
  } else {
    middleware = Array.prototype.slice.call(arguments, 1);
    path = name;
    name = null;
  }

  this.register(path, ['rpc'], middleware, {
    name,
  });

  return this;
};

const Router = require('@eggjs/router').EggRouter;
Router.prototype.rpc = rpc;

class AppWorkerLoader extends egg.AppWorkerLoader {
  constructor(opt) {
    super(opt);
    // 自定义初始化
    // console.log({ opt })
  }

  loadConfig() {
    super.loadConfig();
    // 对 config 进行处理
  }

  load() {
    super.load();
    // 自定义加载其他目录
    // 或对已加载的文件进行处理
    // const logger = this.options.app;

    this.loadProtoBuf(); // 加载 proto
  }
}

Object.assign(AppWorkerLoader.prototype, require('./proto_loader'));


// client error => 400 Bad Request
// Refs: https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_event_clienterror
const DEFAULT_BAD_REQUEST_HTML = `<html>
  <head><title>400 Bad Request</title></head>
  <body bgcolor="white">
  <center><h1>400 Bad Request</h1></center>
  <hr><center>❤</center>
  </body>
  </html>`;
const DEFAULT_BAD_REQUEST_HTML_LENGTH = Buffer.byteLength(DEFAULT_BAD_REQUEST_HTML);
const DEFAULT_BAD_REQUEST_RESPONSE =
  `HTTP/1.1 400 Bad Request\r\nContent-Length: ${DEFAULT_BAD_REQUEST_HTML_LENGTH}` +
  `\r\n\r\n${DEFAULT_BAD_REQUEST_HTML}`;

// Refs: https://github.com/nodejs/node/blob/b38c81/lib/_http_outgoing.js#L706-L710
function escapeHeaderValue(value) {
  // Protect against response splitting. The regex test is there to
  // minimize the performance impact in the common case.
  return /[\r\n]/.test(value) ? value.replace(/[\r\n]+[ \t]*/g, '') : value;
}

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

  [GRPC_RESPONSE_RAW](socket, raw) {
    /* istanbul ignore next */
    if (!socket.writable) return;
    if (!raw) return socket.end(DEFAULT_BAD_REQUEST_RESPONSE);

    const body = (raw.body == null) ? DEFAULT_BAD_REQUEST_HTML : raw.body;
    const headers = raw.headers || {};
    const status = raw.status || 400;

    let responseHeaderLines = '';
    const firstLine = `GRPC ${status} ${http.STATUS_CODES[status] || 'Unknown'}`;

    // Not that safe because no validation for header keys.
    // Refs: https://github.com/nodejs/node/blob/b38c81/lib/_http_outgoing.js#L451
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-length') {
        delete headers[key];
        continue;
      }
      responseHeaderLines += `${key}: ${escapeHeaderValue(headers[key])}\r\n`;
    }

    responseHeaderLines += `Content-Length: ${Buffer.byteLength(body)}\r\n`;

    socket.end(`${firstLine}\r\n${responseHeaderLines}\r\n${body.toString()}`);
  }

  onGrpcClientError(err, socket) {
    // ignore when there is no http body, it almost like an ECONNRESET
    if (err.rawPacket) {
      this.logger.warn('A client (%s:%d) error [%s] occurred: %s',
        socket.remoteAddress,
        socket.remotePort,
        err.code,
        err.message);
    }

    if (typeof this.config.onClientError === 'function') {
      const p = eggUtils.callFn(this.config.onClientError, [err, socket, this]);
      p.then(ret => {
        this[GRPC_RESPONSE_RAW](socket, ret || {});
      }).catch(err => {
        this.logger.error(err);
        this[GRPC_RESPONSE_RAW](socket);
      });
    } else {
      // because it's a raw socket object, we should return the raw HTTP response
      // packet.
      this[GRPC_RESPONSE_RAW](socket);
    }
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
      // console.log(req.call)
      // console.log(res);

      const ctx = this.createAnonymousContext({
        protocol: 'grpc',
        method: 'RPC',
        url: req.call.handler.path,
        path: req.call.handler.path,
        type: req.call.handler.type,
        //  url: `/__schedule?path=${key}&${qs.stringify(schedule.schedule)}`,
      });

      ctx.call = req;
      ctx.callback = res;

      let body = req.request.body;
      body = Buffer.isBuffer(body) ? JSON.parse(body.toString()) : body;
      ctx.request.body = body;

      this.handleRequest(ctx, fn);
      // res(null, { body: Buffer.from(JSON.stringify({ json })) })
    };
    return handleRequest;
  }

  async handleRequest(ctx, fnMiddleware) {

    await fnMiddleware(ctx); // 执行逻辑

    if (ctx.method === 'RPC') {
      const body = typeof ctx.body === 'string' ? ctx.body : JSON.stringify(ctx.body);
      ctx.callback(null, { body: Buffer.from(body) })
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
