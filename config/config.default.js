'use strict';

module.exports = appInfo => {
  const config = {};

  /**
   * some description
   * @member Config#test
   * @property {String} key - some description
   */
  config.test = {
    key: appInfo.name + '_123456',
  };

  // config.gRPC = {
  //   listen: false, // 不启用 gRPCServer
  //   listen: {
  //     port: 50051,
  //     hostname: '0.0.0.0',
  //   },
  //   protoLoader: {
  //     options: { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
  //   },
  //   gRPCServerOptions: {},
  // };


  config.security = {
    csrf: {
      enable: false,
    },
    methodnoallow: {
      enable: false,
    },
    domainWhiteList: ['*'],
  };

  return config;
};
