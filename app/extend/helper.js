'use strict';

module.exports = {

  dns(endpoint) {
    const { ctx, app } = this;

    // .env 有指定，优先返回 env 环境变量，变量名需为大写
    const ENDPOINT = String(`${serviceName}Svc`).replace(/(.)([A-Z])/g, '$1_$2').toUpperCase();
    if (env[ENDPOINT]) {
      return env[ENDPOINT]; // userService -> env[USER_SERVICE_SVC] -> user-service-svc:50051
    }

    const svc = String(serviceName).replace(/(.)([A-Z])/g, '$1-$2').toLowerCase() + '-svc';

    // 线上 k8s 同 namespace 下 develop release production 环境
    if (app.config.env !== 'local') {
      return `${svc}:${port}`; // userService -> user-service-svc:50051
    }

  },

};
