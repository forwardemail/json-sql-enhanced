'use strict';

// Utility function to convert simple regex patterns to LIKE patterns
function convertRegexToLike(pattern) {
  if (typeof pattern !== 'string') {
    return null;
  }

  // Handle exact match: ^text$
  const exactMatch = pattern.match(/^\^(.+)\$$/);
  if (exactMatch) {
    // Unescape common regex escapes for LIKE
    return exactMatch[1].replaceAll('\\.', '.');
  }

  // Handle starts with: ^text
  const startsWith = pattern.match(/^\^(.+)$/);
  if (startsWith) {
    return startsWith[1].replaceAll('\\.', '.') + '%';
  }

  // Handle ends with: text$
  const endsWith = pattern.match(/^(.+)\$$/);
  if (endsWith) {
    return '%' + endsWith[1].replaceAll('\\.', '.');
  }

  // Handle contains (simple text without special regex chars except escaped dots)
  if (!/[.*+?^${}()|[\]\\]/.test(pattern.replaceAll('\\.', '.'))) {
    return '%' + pattern.replaceAll('\\.', '.') + '%';
  }

  return null;
}

module.exports = function (dialect) {
  const buildComparisonCondition = function (field, operator, value) {
    return [field, operator, value].join(' ');
  };

  // MySQL-specific $regex implementation
  dialect.operators.comparison.add('$regex', {
    inversedOperator: '$nregex',
    fn(field, value) {
      // The value comes as a placeholder, we need to get the actual value
      let actualValue = value;

      // If it's a placeholder, get the actual value from the builder
      if (typeof value === 'string' && value.startsWith('$p')) {
        const parameterName = value.slice(1); // Remove the $
        actualValue = dialect.builder._values[parameterName];
      }

      let pattern = actualValue;
      let flags = '';

      // Extract pattern and flags if value is an object
      if (typeof actualValue === 'object' && actualValue !== null) {
        pattern = actualValue.$regex || actualValue.pattern || actualValue;
        flags = actualValue.$options || actualValue.flags || '';
      }

      // Convert simple patterns to LIKE for better performance
      const likePattern = convertRegexToLike(pattern);
      if (likePattern) {
        if (flags.includes('i')) {
          // Case insensitive - use LOWER with LIKE
          return (
            'LOWER('
            + field
            + ') LIKE LOWER('
            + dialect.builder._pushValue(likePattern)
            + ')'
          );
        }

        return buildComparisonCondition(
          field,
          'LIKE',
          dialect.builder._pushValue(likePattern),
        );
      }

      // Use MySQL's REGEXP operator
      if (flags.includes('i')) {
        // MySQL REGEXP is case insensitive by default in some versions
        // Use REGEXP with case insensitive flag
        return buildComparisonCondition(
          field,
          'REGEXP',
          dialect.builder._pushValue('(?i)' + pattern),
        );
      }

      return buildComparisonCondition(
        field,
        'REGEXP',
        dialect.builder._pushValue(pattern),
      );
    },
  });

  // MySQL-specific $nregex implementation
  dialect.operators.comparison.add('$nregex', {
    inversedOperator: '$regex',
    fn(field, value) {
      // The value comes as a placeholder, we need to get the actual value
      let actualValue = value;

      // If it's a placeholder, get the actual value from the builder
      if (typeof value === 'string' && value.startsWith('$p')) {
        const parameterName = value.slice(1); // Remove the $
        actualValue = dialect.builder._values[parameterName];
      }

      let pattern = actualValue;
      let flags = '';

      // Extract pattern and flags if value is an object
      if (typeof actualValue === 'object' && actualValue !== null) {
        pattern = actualValue.$regex || actualValue.pattern || actualValue;
        flags = actualValue.$options || actualValue.flags || '';
      }

      // Convert simple patterns to LIKE for better performance
      const likePattern = convertRegexToLike(pattern);
      if (likePattern) {
        if (flags.includes('i')) {
          // Case insensitive - use NOT LOWER with LIKE
          return (
            'NOT (LOWER('
            + field
            + ') LIKE LOWER('
            + dialect.builder._pushValue(likePattern)
            + '))'
          );
        }

        return (
          'NOT ('
          + buildComparisonCondition(
            field,
            'LIKE',
            dialect.builder._pushValue(likePattern),
          )
          + ')'
        );
      }

      // Use MySQL's NOT REGEXP operator
      if (flags.includes('i')) {
        return (
          'NOT ('
          + buildComparisonCondition(
            field,
            'REGEXP',
            dialect.builder._pushValue('(?i)' + pattern),
          )
          + ')'
        );
      }

      return (
        'NOT ('
        + buildComparisonCondition(
          field,
          'REGEXP',
          dialect.builder._pushValue(pattern),
        )
        + ')'
      );
    },
  });

  // MySQL-specific $elemMatch using JSON functions (MySQL 5.7+)
  dialect.operators.comparison.add('$elemMatch', {
    fn(field, value) {
      // MySQL has JSON support since 5.7
      const conditions = [];

      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }

        const subValue = value[key];
        const jsonPath = '$[*].' + key;

        if (
          typeof subValue === 'object'
          && subValue !== null
          && !Array.isArray(subValue)
        ) {
          // Handle nested operators
          for (const operator in subValue) {
            if (!Object.prototype.hasOwnProperty.call(subValue, operator)) {
              continue;
            }

            if (operator.startsWith('$')) {
              const operatorImpl = dialect.operators.comparison.get(operator);
              if (operatorImpl) {
                let condition;
                if (typeof operatorImpl === 'function') {
                  condition = operatorImpl.call(
                    dialect,
                    'JSON_EXTRACT(' + field + ', \'' + jsonPath + '\')',
                    subValue[operator],
                  );
                } else if (operatorImpl.fn) {
                  condition = operatorImpl.fn.call(
                    dialect,
                    'JSON_EXTRACT(' + field + ', \'' + jsonPath + '\')',
                    subValue[operator],
                  );
                }

                if (condition) {
                  conditions.push(condition);
                }
              }
            }
          }
        } else {
          // Direct value comparison using MySQL JSON functions
          conditions.push(
            'JSON_CONTAINS('
              + field
              + ', JSON_OBJECT(\''
              + key
              + '\', '
              + dialect.builder._pushValue(subValue)
              + '))',
          );
        }
      }

      if (conditions.length === 0) {
        return 'TRUE';
      }

      // Validate that field contains JSON array
      const typeCheck = 'JSON_TYPE(' + field + ') = \'ARRAY\'';
      return '(' + typeCheck + ' AND (' + conditions.join(' AND ') + '))';
    },
  });
};
