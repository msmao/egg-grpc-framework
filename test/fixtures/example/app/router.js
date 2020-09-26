'use strict';

module.exports = app => {
  const { router, controller } = app;
  router.rpc('/user/login', controller.user.login);
  router.get('/rpc', controller.user.test);
};
