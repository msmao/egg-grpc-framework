
支持 gRPC 请求的 egg 框架

## 特性

1. 支持 gRPC + Protobuf
2. 扩展 egg 路由支持 RPC 方法
3. 支持 egg 的中间件、插件
4. 同时支持 HTTP、gRPC 请求，且可共用 Controller 和 Service

## 快速开始

```bash
$ npm install egg-obelisk --save
```

```json
// package.json
{
  "name": "user",
  "egg": {
    "framework": "egg-obelisk"
  },
}
```

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

```bash
$ curl http://localhost:7001/rpc?username=admin&password=xxx
```
