'use strict';

const Router = require('@eggjs/router').EggRouter;

Router.prototype.rpc = function (name, path /* , middleware */) {
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
};;

module.exports = Router;
