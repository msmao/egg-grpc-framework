'use strict';

const env = process.env;

module.exports = {

  dns(service) {
    const { ctx, app } = this;

    // local env
    if (app.config.env === 'local' && service === `${app.name}Service`) {
      return { service, endpoint: '127.0.0.1:50051' };
    }

    // .env 有指定，优先返回 env 环境变量，变量名需为大写
    const ENDPOINT = service.replace('Service', 'Svc').replace(/(.)([A-Z])/g, '$1_$2').toUpperCase();
    if (env[ENDPOINT]) {
      return { service, endpoint: env[ENDPOINT] }; // userService -> env[USER_SVC] -> user-svc:50051
    }

    const svc = service.replace('Service', 'Svc').replace(/(.)([A-Z])/g, '$1-$2').toLowerCase();
    // 线上 k8s 同 namespace 下 develop release production 环境
    if (app.config.env !== 'local') {
      return { service, endpoint: `${svc}:${50051}` }; // userService -> user-svc:50051
    }

  },

};
