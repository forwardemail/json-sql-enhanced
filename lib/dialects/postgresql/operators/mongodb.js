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

  // PostgreSQL-specific $regex implementation with native regex support
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
          // Case insensitive - use ILIKE (PostgreSQL specific)
          return buildComparisonCondition(
            field,
            'ILIKE',
            dialect.builder._pushValue(likePattern),
          );
        }

        return buildComparisonCondition(
          field,
          'LIKE',
          dialect.builder._pushValue(likePattern),
        );
      }

      // Use PostgreSQL's native regex operators
      if (flags.includes('i')) {
        // Case insensitive regex
        return buildComparisonCondition(
          field,
          '~*',
          dialect.builder._pushValue(pattern),
        );
      }

      // Case sensitive regex
      return buildComparisonCondition(
        field,
        '~',
        dialect.builder._pushValue(pattern),
      );
    },
  });

  // PostgreSQL-specific $nregex implementation
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
          // Case insensitive - use NOT ILIKE (PostgreSQL specific)
          return (
            'NOT ('
            + buildComparisonCondition(
              field,
              'ILIKE',
              dialect.builder._pushValue(likePattern),
            )
            + ')'
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

      // Use PostgreSQL's native regex operators
      if (flags.includes('i')) {
        // Case insensitive regex negation
        return buildComparisonCondition(
          field,
          '!~*',
          dialect.builder._pushValue(pattern),
        );
      }

      // Case sensitive regex negation
      return buildComparisonCondition(
        field,
        '!~',
        dialect.builder._pushValue(pattern),
      );
    },
  });

  // PostgreSQL-specific $elemMatch using JSON functions
  dialect.operators.comparison.add('$elemMatch', {
    fn(field, value) {
      // PostgreSQL has excellent JSON support
      const conditions = [];

      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }

        const subValue = value[key];
        const jsonPath = key;

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
                    'jsonb_path_query(' + field + ', \'$[*].' + jsonPath + '\')',
                    subValue[operator],
                  );
                } else if (operatorImpl.fn) {
                  condition = operatorImpl.fn.call(
                    dialect,
                    'jsonb_path_query(' + field + ', \'$[*].' + jsonPath + '\')',
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
          // Direct value comparison using PostgreSQL JSON path queries
          conditions.push(
            'EXISTS (SELECT 1 FROM jsonb_array_elements('
              + field
              + ') AS elem WHERE elem->\''
              + jsonPath
              + '\' = '
              + dialect.builder._pushValue(JSON.stringify(subValue))
              + ')',
          );
        }
      }

      if (conditions.length === 0) {
        return 'TRUE';
      }

      return '(' + conditions.join(' AND ') + ')';
    },
  });
};
