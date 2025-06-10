'use strict';

const comparisonOperatorsInit = require('./comparison.js');
const fetchingOperatorsInit = require('./fetching.js');
const mongodbOperatorsInit = require('./mongodb.js');

module.exports = function (dialect) {
  comparisonOperatorsInit(dialect);
  fetchingOperatorsInit(dialect);
  mongodbOperatorsInit(dialect);
};
