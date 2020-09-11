'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;

  router.get('/', controller.home.index);
  
  router.get('/index', controller.home.index);

  router.rpc('/rpc/invoke', controller.home.rpc);
  router.rpc('/rpc/test', controller.home.test);
};
