'use strict';

module.exports = function (dialect) {
  dialect.operators.fetching.add('$field', {
    fn(value) {
      return dialect.buildBlock('term', {term: value, type: 'field'});
    },
  });

  dialect.operators.fetching.add('$value', {
    fn(value) {
      return dialect.buildBlock('term', {term: value, type: 'value'});
    },
  });

  dialect.operators.fetching.add('$func', {
    fn(value) {
      return dialect.buildBlock('term', {term: value, type: 'func'});
    },
  });

  dialect.operators.fetching.add('$expression', {
    fn(value) {
      return dialect.buildBlock('term', {term: value, type: 'expression'});
    },
  });

  dialect.operators.fetching.add('$select', {
    fn(value) {
      return dialect.buildTemplate('subQuery', {queryBody: value});
    },
  });

  dialect.operators.fetching.add('$query', {
    fn(value) {
      return dialect.buildTemplate('subQuery', {queryBody: value});
    },
  });

  dialect.operators.fetching.add('$boolean', {
    fn: Boolean,
  });

  dialect.operators.fetching.add('$inValues', {
    fn(value) {
      if (typeof value !== 'object' || value === null) {
        throw new TypeError(
          'Invalid `$in/$nin` value type "' + typeof value + '"',
        );
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          value = [null];
        }

        return (
          '('
          + value.map(item => dialect.builder._pushValue(item)).join(', ')
          + ')'
        );
      }

      return dialect.buildTemplate('subQuery', {queryBody: value});
    },
  });

  dialect.operators.fetching.add('$betweenValues', {
    fn(value) {
      if (!Array.isArray(value)) {
        throw new TypeError(
          'Invalid `$between` value type "' + typeof value + '"',
        );
      }

      if (value.length < 2) {
        throw new Error('`$between` array length should be 2 or greater');
      }

      return (
        dialect.builder._pushValue(value[0])
        + ' and '
        + dialect.builder._pushValue(value[1])
      );
    },
  });
};
