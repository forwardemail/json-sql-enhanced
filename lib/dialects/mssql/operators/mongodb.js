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
  // MSSQL-specific $regex implementation
  dialect.operators.comparison.add('$regex', {
    inversedOperator: '$nregex',
    fn(field, value) {
      // Get the actual pattern and options
      const pattern = value;
      let flags = '';

      // Check if there's an $options in the current condition
      if (dialect.currentCondition && dialect.currentCondition.$options) {
        flags = dialect.currentCondition.$options;
      }

      // Convert simple patterns to LIKE for better performance
      const likePattern = convertRegexToLike(pattern);
      if (likePattern) {
        const valueParameter = dialect.builder._pushValue(likePattern);
        if (flags.includes('i')) {
          return `LOWER(${field}) LIKE LOWER(${valueParameter})`;
        }

        return `${field} LIKE ${valueParameter}`;
      }

      // MSSQL doesn't have native regex, fall back to LIKE with wildcards
      const likeApproximation = pattern
        .replaceAll('\\.', '.') // Unescape dots
        .replaceAll('.*', '%') // .* -> %
        .replaceAll('.', '_') // . -> _
        .replaceAll('+', '') // Remove + (not perfect)
        .replaceAll('*', '%'); // * -> %

      const valueParameter = dialect.builder._pushValue(likeApproximation);
      if (flags.includes('i')) {
        return `LOWER(${field}) LIKE LOWER(${valueParameter})`;
      }

      return `${field} LIKE ${valueParameter}`;
    },
  });

  // MSSQL-specific $nregex implementation
  dialect.operators.comparison.add('$nregex', {
    inversedOperator: '$regex',
    fn(field, value) {
      const regexCondition = dialect.operators.comparison
        .get('$regex')
        .fn.call(this, field, value);
      return `NOT (${regexCondition})`;
    },
  });

  // MSSQL-specific $elemMatch using JSON functions (SQL Server 2016+)
  dialect.operators.comparison.add('$elemMatch', {
    fn(field, value) {
      const conditions = [];

      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }

        const subValue = value[key];

        if (
          typeof subValue === 'object' &&
          subValue !== null &&
          !Array.isArray(subValue)
        ) {
          // Handle nested operators
          for (const operator in subValue) {
            if (!Object.prototype.hasOwnProperty.call(subValue, operator)) {
              continue;
            }

            if (operator.startsWith('$')) {
              conditions.push(
                handleMongoOperator(operator, subValue, field, key, dialect)
              );
            } else {
              const valueParameter = dialect.builder._pushValue(subValue);
              conditions.push(
                `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${operator}') = ${valueParameter})`
              );
            }
          }
        } else {
          const valueParameter = dialect.builder._pushValue(subValue);
          conditions.push(
            `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') = ${valueParameter})`
          );
        }
      }

      // Validate that field contains JSON
      const typeCheck = `ISJSON(${field}) = 1`;
      return conditions.length > 0
        ? `(${typeCheck} AND (${conditions.join(' AND ')}))`
        : typeCheck;
    },
  });

  // Helper function to handle MongoDB operators in $elemMatch
  function handleMongoOperator(operator, subValue, field, key, dialect) {
    if (operator === '$regex') {
      const options = subValue.$options || '';
      const pattern = subValue[operator];
      const likePattern = convertRegexToLike(pattern);

      if (likePattern) {
        const valueParameter = dialect.builder._pushValue(likePattern);
        if (options.includes('i')) {
          return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE LOWER(JSON_VALUE(element.value, '$.${key}')) LIKE LOWER(${valueParameter}))`;
        }

        return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') LIKE ${valueParameter})`;
      }

      // Fallback for complex patterns
      const likeApproximation = pattern
        .replaceAll('\\.', '.')
        .replaceAll('.*', '%')
        .replaceAll('.', '_')
        .replaceAll('+', '')
        .replaceAll('*', '%');
      const valueParameter = dialect.builder._pushValue(likeApproximation);
      if (options.includes('i')) {
        return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE LOWER(JSON_VALUE(element.value, '$.${key}')) LIKE LOWER(${valueParameter}))`;
      }

      return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') LIKE ${valueParameter})`;
    }

    if (operator === '$exists') {
      if (subValue[operator]) {
        return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') IS NOT NULL)`;
      }

      return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') IS NULL)`;
    }

    if (operator === '$ne') {
      const valueParameter = dialect.builder._pushValue(subValue[operator]);
      return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') != ${valueParameter})`;
    }

    // Default case for other operators
    const valueParameter = dialect.builder._pushValue(subValue[operator]);
    return `EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') = ${valueParameter})`;
  }

  // MSSQL-specific $size implementation
  dialect.operators.comparison.add('$size', {
    fn(field, value) {
      return handleSizeOperator(field, value, dialect);
    },
  });

  // Helper function for $size operator
  function handleSizeOperator(field, value, dialect) {
    // Handle nested operators like { $gt: 0 }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const conditions = [];
      for (const operator in value) {
        if (!Object.prototype.hasOwnProperty.call(value, operator)) {
          continue;
        }

        if (operator.startsWith('$')) {
          const condition = buildSizeCondition(
            field,
            operator,
            value[operator],
            dialect
          );
          if (condition) {
            conditions.push(condition);
          }
        }
      }

      return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    }

    // Simple size comparison
    const valueParameter = dialect.builder._pushValue(value);
    return `(SELECT COUNT(*) FROM OPENJSON(${field})) = ${valueParameter}`;
  }

  // Helper function to build size condition
  function buildSizeCondition(field, operator, value, dialect) {
    const lengthExpression = `(SELECT COUNT(*) FROM OPENJSON(${field}))`;
    const operatorImpl = dialect.operators.comparison.get(operator);
    if (!operatorImpl) {
      return null;
    }

    let condition;
    if (typeof operatorImpl === 'function') {
      const temporaryField = lengthExpression.replaceAll('"', '');
      condition = operatorImpl.call(dialect, temporaryField, value);
      condition = condition.replaceAll(
        dialect.wrapIdentifier(temporaryField),
        lengthExpression
      );
    } else if (operatorImpl.fn) {
      const temporaryField = lengthExpression.replaceAll('"', '');
      condition = operatorImpl.fn.call(dialect, temporaryField, value);
      condition = condition.replaceAll(
        dialect.wrapIdentifier(temporaryField),
        lengthExpression
      );
    }

    return condition;
  }

  // MSSQL-specific $exists implementation
  dialect.operators.comparison.add('$exists', {
    fn(field, value) {
      if (value) {
        return `${field} IS NOT NULL`;
      }

      return `${field} IS NULL`;
    },
  });

  // MSSQL-specific $not implementation
  dialect.operators.comparison.add('$not', {
    fn(field, value) {
      return handleNotOperator(field, value, dialect);
    },
  });

  // Helper function for $not operator
  function handleNotOperator(field, value, dialect) {
    if (typeof value === 'object' && value !== null) {
      const conditions = [];
      for (const operator in value) {
        if (!Object.prototype.hasOwnProperty.call(value, operator)) {
          continue;
        }

        const condition = buildNotCondition(field, operator, value, dialect);
        if (condition) {
          conditions.push(condition);
        }
      }

      return conditions.join(' AND ');
    }

    const valueParameter = dialect.builder._pushValue(value);
    return `${field} != ${valueParameter}`;
  }

  // Helper function to build not condition
  function buildNotCondition(field, operator, value, dialect) {
    if (operator === '$regex') {
      const options = value.$options || '';
      const pattern = value[operator];
      const likePattern = convertRegexToLike(pattern);

      if (likePattern) {
        const valueParameter = dialect.builder._pushValue(likePattern);
        if (options.includes('i')) {
          return `NOT (LOWER(${field}) LIKE LOWER(${valueParameter}))`;
        }

        return `NOT (${field} LIKE ${valueParameter})`;
      }
    } else if (operator === '$elemMatch') {
      const elementMatchCondition = dialect.operators.comparison
        .get('$elemMatch')
        .fn.call(dialect, field, value[operator]);
      return `NOT (${elementMatchCondition})`;
    }

    return null;
  }

  // $options operator (handled by $regex, but registered to avoid errors)
  dialect.operators.comparison.add('$options', {
    fn(_field, _options) {
      return '';
    },
  });
};
