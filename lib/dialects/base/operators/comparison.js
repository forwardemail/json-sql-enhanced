'use strict';

const buildComparisonOperator = function (field, operator, value) {
  return [field, operator, value].join(' ');
};

const buildBooleanOperator = function (field, operator, value) {
  return buildComparisonOperator(field, 'is' + (value ? '' : ' not'), operator);
};

// Import MongoDB operators
const mongodbOperatorsInit = require('./mongodb.js');

module.exports = function (dialect) {
  // Initialize MongoDB operators first
  mongodbOperatorsInit(dialect);

  // Standard comparison operators
  dialect.operators.comparison.set('$eq', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, '=', fieldValue);
  });

  dialect.operators.comparison.set('$ne', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, '!=', fieldValue);
  });

  dialect.operators.comparison.set('$gt', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, '>', fieldValue);
  });

  dialect.operators.comparison.set('$gte', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, '>=', fieldValue);
  });

  dialect.operators.comparison.set('$lt', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, '<', fieldValue);
  });

  dialect.operators.comparison.set('$lte', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, '<=', fieldValue);
  });

  dialect.operators.comparison.set('$like', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, 'like', fieldValue);
  });

  dialect.operators.comparison.set('$nlike', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, 'not like', fieldValue);
  });

  dialect.operators.comparison.set('$ilike', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    const fieldValue = this.builder._pushValue(value);
    return buildComparisonOperator(fieldName, 'ilike', fieldValue);
  });

  dialect.operators.comparison.set('$in', function (field, values) {
    if (!Array.isArray(values)) {
      throw new TypeError('$in operator requires an array');
    }

    const fieldName = this.wrapIdentifier(field);
    const valuesString = values
      .map(value => this.builder._pushValue(value))
      .join(', ');

    return fieldName + ' in (' + valuesString + ')';
  });

  dialect.operators.comparison.set('$nin', function (field, values) {
    if (!Array.isArray(values)) {
      throw new TypeError('$nin operator requires an array');
    }

    const fieldName = this.wrapIdentifier(field);
    const valuesString = values
      .map(value => this.builder._pushValue(value))
      .join(', ');

    return fieldName + ' not in (' + valuesString + ')';
  });

  dialect.operators.comparison.set('$is', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    return buildBooleanOperator(fieldName, value, true);
  });

  dialect.operators.comparison.set('$isnot', function (field, value) {
    const fieldName = this.wrapIdentifier(field);
    return buildBooleanOperator(fieldName, value, false);
  });
};
