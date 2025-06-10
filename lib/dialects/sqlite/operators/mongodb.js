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

  // SQLite-specific $regex implementation with GLOB fallback
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
          // Case insensitive - use LOWER
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

      // Try GLOB conversion for SQLite
      const globPattern = convertRegexToGlob(pattern);
      if (globPattern) {
        if (flags.includes('i')) {
          // GLOB is case sensitive, so we need to use LOWER for case insensitive
          return (
            'LOWER('
            + field
            + ') GLOB LOWER('
            + dialect.builder._pushValue(globPattern)
            + ')'
          );
        }

        return buildComparisonCondition(
          field,
          'GLOB',
          dialect.builder._pushValue(globPattern),
        );
      }

      // Fall back to REGEXP operator (requires extension)
      if (flags.includes('i')) {
        // For case insensitive, we'll pass the flag in the pattern
        return buildComparisonCondition(
          field,
          'REGEXP',
          dialect.builder._pushValue('(?i)' + pattern),
        );
      }

      return buildComparisonCondition(field, 'REGEXP', dialect.builder._pushValue(pattern));
    },
  });

  // SQLite-specific $nregex implementation
  dialect.operators.comparison.add('$nregex', {
    inversedOperator: '$regex',
    fn(field, value) {
      const regexCondition = dialect.operators.comparison
        .get('$regex')
        .fn(field, value);
      return 'NOT (' + regexCondition + ')';
    },
  });

  // SQLite-specific $elemMatch using JSON functions
  dialect.operators.comparison.add('$elemMatch', {
    fn(field, value) {
      // Validate that field contains JSON array
      const typeCheck = 'json_type(' + field + ') = \'array\'';

      // Build conditions for array elements
      const conditions = [];

      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }

        const subValue = value[key];
        const jsonPath = '$.' + key;

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
                    'json_extract(value, "' + jsonPath + '")',
                    subValue[operator],
                  );
                } else if (operatorImpl.fn) {
                  condition = operatorImpl.fn.call(
                    dialect,
                    'json_extract(value, "' + jsonPath + '")',
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
          // Direct value comparison
          conditions.push(
            'json_extract(value, \''
              + jsonPath
              + '\') = '
              + dialect.builder._pushValue(subValue),
          );
        }
      }

      const whereClause = conditions.join(' AND ');
      const elementMatch
        = 'EXISTS (SELECT 1 FROM json_each('
        + field
        + ') WHERE '
        + whereClause
        + ')';

      return '(' + typeCheck + ' AND ' + elementMatch + ')';
    },
  });
};

// Utility function to convert simple regex patterns to GLOB patterns
function convertRegexToGlob(pattern) {
  if (typeof pattern !== 'string') {
    return null;
  }

  // Very basic conversion - only handle simple cases
  // This is a simplified implementation
  let globPattern = pattern;

  // Convert some basic regex to glob
  globPattern = globPattern.replace('.*', '*'); // .* -> *
  globPattern = globPattern.replace('.', '?'); // . -> ?

  // Only return if it looks like a valid glob pattern
  if (globPattern !== pattern && !/[+^${}()|[\]\\]/.test(globPattern)) {
    return globPattern;
  }

  return null;
}
