'use strict';

const comparisonOperatorsInit = require('./comparison.js');
const logicalOperatorsInit = require('./logical.js');
const fetchingOperatorsInit = require('./fetching.js');
const stateOperatorsInit = require('./state.js');

module.exports = function (dialect) {
  comparisonOperatorsInit(dialect);
  logicalOperatorsInit(dialect);
  fetchingOperatorsInit(dialect);
  stateOperatorsInit(dialect);
};
