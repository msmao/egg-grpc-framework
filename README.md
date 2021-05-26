
gRPC framework for egg

[中文文档](README.zh-CN.md)

## Features

1. Support gRPC + Protobuf
2. Extend EGG Router To Support RPC Method
3. It Supports EGG Middleware、Plugin
4. It Supports Both HTTP、gRPC Request，Common Use Controller And Service

## QuickStart

```bash
$ npm install egg-grpc-framework --save
```

## Usage

```json
// package.json
{
  "name": "user",
  "egg": {
    "framework": "egg-grpc-framework"
  },
  // ...
}
```

## Configuration

```js
// {app_root}/config/config.default.js
config.gRPC = {
  // listen: false, // disable gRPCServer
  listen: {
    port: 50051,
    hostname: '0.0.0.0',
  },
  // protoLoader: {
  //   options: { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
  // },
  // gRPCServerOptions: {},
};
```

## Example

```js
// {app_root}/app/router.js
'use strict';

module.exports = app => {
  const { router, controller } = app;
  router.rpc('/user/login', controller.user.login);
  router.get('/rpc', controller.user.test);
};
```

```js
// {app_root}/app/controller/user.js
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
```

```js
// {app_root}/app/service/user.js
'use strict';

const Service = require('egg').Service;

class UserService extends Service {

  async login() {
    // ...
    return { state: 'ok' };
  }

}

module.exports = UserService;
```

## Test

```bash
$ curl http://localhost:7001/rpc?username=admin&password=xxx
```
