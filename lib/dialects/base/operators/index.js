'use strict';

const comparisonOperatorsInit = require('./comparison');
const logicalOperatorsInit = require('./logical');
const fetchingOperatorsInit = require('./fetching');
const stateOperatorsInit = require('./state');

module.exports = function (dialect) {
  comparisonOperatorsInit(dialect);
  logicalOperatorsInit(dialect);
  fetchingOperatorsInit(dialect);
  stateOperatorsInit(dialect);
};
