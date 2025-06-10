'use strict';

const comparisonOperatorsInit = require('./comparison');
const fetchingOperatorsInit = require('./fetching');
const mongodbOperatorsInit = require('./mongodb');

module.exports = function (dialect) {
  comparisonOperatorsInit(dialect);
  fetchingOperatorsInit(dialect);
  mongodbOperatorsInit(dialect);
};
