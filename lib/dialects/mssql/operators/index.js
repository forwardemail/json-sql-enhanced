'use strict';

const mongodbOperatorsInit = require('./mongodb.js');

module.exports = function (dialect) {
  mongodbOperatorsInit(dialect);
};
