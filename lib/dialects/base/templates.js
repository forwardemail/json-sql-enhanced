'use strict';

const templateChecks = require('../../utils/templateChecks.js');

module.exports = function (dialect) {
  const availableJoinTypes = new Set([
    'natural',
    'cross',
    'inner',
    'outer',
    'left',
    'right',
    'full',
    'self',
  ]);
  const orRegExp = /^(rollback|abort|replace|fail|ignore)$/i;

  // Helper function to check if array contains only valid join types
  function isValidJoinType(value) {
    const splitType = value.toLowerCase().split(' ').filter(Boolean);
    return splitType.every(type => availableJoinTypes.has(type));
  }

  // Private templates

  dialect.templates.add('query', {
    pattern: '{queryBody}',
    validate(type, parameters) {
      templateChecks.requiredProp(type, parameters, 'queryBody');
      templateChecks.propType(type, parameters, 'queryBody', 'object');
    },
  });

  dialect.templates.add('subQuery', {
    pattern: '({queryBody}) {alias}',
    validate(type, parameters) {
      templateChecks.requiredProp(type, parameters, 'queryBody');
      templateChecks.propType(type, parameters, 'queryBody', 'object');

      templateChecks.propType(type, parameters, 'alias', ['string', 'object']);
    },
  });

  dialect.templates.add('queriesCombination', {
    pattern: '{with} {withRecursive} {queries} {sort} {limit} {offset}',
    validate(type, parameters) {
      templateChecks.onlyOneOfProps(type, parameters, [
        'with',
        'withRecursive',
      ]);
      templateChecks.propType(type, parameters, 'with', 'object');
      templateChecks.propType(type, parameters, 'withRecursive', 'object');

      templateChecks.requiredProp(type, parameters, 'queries');
      templateChecks.propType(type, parameters, 'queries', 'array');
      templateChecks.minPropLength(type, parameters, 'queries', 2);

      templateChecks.propType(type, parameters, 'sort', [
        'string',
        'array',
        'object',
      ]);

      templateChecks.propType(type, parameters, 'limit', ['number', 'string']);

      templateChecks.propType(type, parameters, 'offset', ['number', 'string']);
    },
  });

  dialect.templates.add('insertValues', {
    pattern: '({fields}) values {values}',
    validate(type, parameters) {
      templateChecks.requiredProp('values', parameters, 'fields');
      templateChecks.propType('values', parameters, 'fields', 'array');
      templateChecks.minPropLength('values', parameters, 'fields', 1);

      templateChecks.requiredProp('values', parameters, 'values');
      templateChecks.propType('values', parameters, 'values', 'array');
      templateChecks.minPropLength('values', parameters, 'values', 1);
    },
  });

  dialect.templates.add('joinItem', {
    pattern: '{type} join {table} {query} {select} {expression} {alias} {on}',
    validate(type, parameters) {
      templateChecks.propType('join', parameters, 'type', 'string');
      templateChecks.customProp('join', parameters, 'type', isValidJoinType);

      templateChecks.atLeastOneOfProps('join', parameters, [
        'table',
        'query',
        'select',
        'expression',
      ]);
      templateChecks.onlyOneOfProps('join', parameters, [
        'table',
        'query',
        'select',
        'expression',
      ]);

      templateChecks.propType('join', parameters, 'table', 'string');
      templateChecks.propType('join', parameters, 'query', 'object');
      templateChecks.propType('join', parameters, 'select', 'object');
      templateChecks.propType('join', parameters, 'expression', [
        'string',
        'object',
      ]);

      templateChecks.propType('join', parameters, 'alias', [
        'string',
        'object',
      ]);

      templateChecks.propType('join', parameters, 'on', ['array', 'object']);
    },
  });

  dialect.templates.add('withItem', {
    pattern: '{name} {fields} as {query} {select} {expression}',
    validate(type, parameters) {
      templateChecks.requiredProp('with', parameters, 'name');
      templateChecks.propType('with', parameters, 'name', 'string');

      templateChecks.propType(type, parameters, 'fields', ['array', 'object']);

      templateChecks.atLeastOneOfProps('with', parameters, [
        'query',
        'select',
        'expression',
      ]);
      templateChecks.onlyOneOfProps('with', parameters, [
        'query',
        'select',
        'expression',
      ]);

      templateChecks.propType('with', parameters, 'query', 'object');
      templateChecks.propType('with', parameters, 'select', 'object');
      templateChecks.propType('with', parameters, 'expression', [
        'string',
        'object',
      ]);
    },
  });

  dialect.templates.add('fromItem', {
    pattern: '{table} {query} {select} {expression} {alias}',
    validate(type, parameters) {
      templateChecks.atLeastOneOfProps('from', parameters, [
        'table',
        'query',
        'select',
        'expression',
      ]);
      templateChecks.onlyOneOfProps('from', parameters, [
        'table',
        'query',
        'select',
        'expression',
      ]);

      templateChecks.propType('from', parameters, 'table', 'string');
      templateChecks.propType('from', parameters, 'query', 'object');
      templateChecks.propType('from', parameters, 'select', 'object');
      templateChecks.propType('from', parameters, 'expression', [
        'string',
        'object',
      ]);

      templateChecks.propType('from', parameters, 'alias', [
        'string',
        'object',
      ]);
    },
  });

  // Public templates

  dialect.templates.add('select', {
    pattern:
      '{with} {withRecursive} select {distinct} {fields} '
      + 'from {from} {table} {query} {select} {expression} {alias} '
      + '{join} {condition} {group} {having} {sort} {limit} {offset}',
    defaults: {
      fields: {},
    },
    validate(type, parameters) {
      templateChecks.onlyOneOfProps(type, parameters, [
        'with',
        'withRecursive',
      ]);
      templateChecks.propType(type, parameters, 'with', 'object');
      templateChecks.propType(type, parameters, 'withRecursive', 'object');

      templateChecks.propType(type, parameters, 'distinct', 'boolean');

      templateChecks.propType(type, parameters, 'fields', ['array', 'object']);

      templateChecks.propType(type, parameters, 'from', [
        'string',
        'array',
        'object',
      ]);

      templateChecks.atLeastOneOfProps(type, parameters, [
        'table',
        'query',
        'select',
        'expression',
      ]);
      templateChecks.onlyOneOfProps(type, parameters, [
        'table',
        'query',
        'select',
        'expression',
      ]);

      templateChecks.propType(type, parameters, 'table', 'string');
      templateChecks.propType(type, parameters, 'query', 'object');
      templateChecks.propType(type, parameters, 'select', 'object');
      templateChecks.propType(type, parameters, 'expression', [
        'string',
        'object',
      ]);

      templateChecks.propType(type, parameters, 'alias', ['string', 'object']);

      templateChecks.propType(type, parameters, 'join', ['array', 'object']);

      templateChecks.propType(type, parameters, 'condition', [
        'array',
        'object',
      ]);
      templateChecks.propType(type, parameters, 'having', ['array', 'object']);

      templateChecks.propType(type, parameters, 'group', ['string', 'array']);

      templateChecks.propType(type, parameters, 'sort', [
        'string',
        'array',
        'object',
      ]);

      templateChecks.propType(type, parameters, 'limit', ['number', 'string']);

      templateChecks.propType(type, parameters, 'offset', ['number', 'string']);
    },
  });

  dialect.templates.add('insert', {
    pattern:
      '{with} {withRecursive} insert {or} into {table} {values} {condition} '
      + '{returning}',
    validate(type, parameters) {
      templateChecks.onlyOneOfProps(type, parameters, [
        'with',
        'withRecursive',
      ]);
      templateChecks.propType(type, parameters, 'with', 'object');
      templateChecks.propType(type, parameters, 'withRecursive', 'object');

      templateChecks.propType(type, parameters, 'or', 'string');
      templateChecks.propMatch(type, parameters, 'or', orRegExp);

      templateChecks.requiredProp(type, parameters, 'table');
      templateChecks.propType(type, parameters, 'table', 'string');

      templateChecks.requiredProp(type, parameters, 'values');
      templateChecks.propType(type, parameters, 'values', ['array', 'object']);

      templateChecks.propType(type, parameters, 'condition', [
        'array',
        'object',
      ]);

      templateChecks.propType(type, parameters, 'returning', [
        'array',
        'object',
      ]);
    },
  });

  dialect.templates.add('update', {
    pattern:
      '{with} {withRecursive} update {or} {table} {alias} {modifier} {condition} {returning}',
    validate(type, parameters) {
      templateChecks.onlyOneOfProps(type, parameters, [
        'with',
        'withRecursive',
      ]);
      templateChecks.propType(type, parameters, 'with', 'object');
      templateChecks.propType(type, parameters, 'withRecursive', 'object');

      templateChecks.propType(type, parameters, 'or', 'string');
      templateChecks.propMatch(type, parameters, 'or', orRegExp);

      templateChecks.requiredProp(type, parameters, 'table');
      templateChecks.propType(type, parameters, 'table', 'string');

      templateChecks.propType(type, parameters, 'alias', 'string');

      templateChecks.requiredProp(type, parameters, 'modifier');
      templateChecks.propType(type, parameters, 'modifier', 'object');

      templateChecks.propType(type, parameters, 'condition', [
        'array',
        'object',
      ]);

      templateChecks.propType(type, parameters, 'returning', [
        'array',
        'object',
      ]);
    },
  });

  dialect.templates.add('remove', {
    pattern:
      '{with} {withRecursive} delete from {table} {alias} {condition} {returning}',
    validate(type, parameters) {
      templateChecks.onlyOneOfProps(type, parameters, [
        'with',
        'withRecursive',
      ]);
      templateChecks.propType(type, parameters, 'with', 'object');
      templateChecks.propType(type, parameters, 'withRecursive', 'object');

      templateChecks.requiredProp(type, parameters, 'table');
      templateChecks.propType(type, parameters, 'table', 'string');

      templateChecks.propType(type, parameters, 'alias', 'string');

      templateChecks.propType(type, parameters, 'condition', [
        'array',
        'object',
      ]);

      templateChecks.propType(type, parameters, 'returning', [
        'array',
        'object',
      ]);
    },
  });

  dialect.templates.add('union', dialect.templates.get('queriesCombination'));

  dialect.templates.add(
    'intersect',
    dialect.templates.get('queriesCombination'),
  );

  dialect.templates.add('except', dialect.templates.get('queriesCombination'));
};
