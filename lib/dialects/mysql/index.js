'use strict';

const {inherits} = require('util');
const BaseDialect = require('../base/index.js');

const Dialect = function (builder) {
  BaseDialect.call(this, builder);

  // Load MySQL-specific MongoDB operators
  const operatorsInit = require('./operators/index.js');
  operatorsInit(this);
};

module.exports = Dialect;

inherits(Dialect, BaseDialect);

Dialect.prototype.config = {
  ...BaseDialect.prototype.config,
  identifierPrefix: '`',
  identifierSuffix: '`',
};
