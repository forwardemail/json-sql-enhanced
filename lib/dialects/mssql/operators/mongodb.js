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
      let pattern = value;
      let flags = '';

      // Check if there's an $options in the current condition
      if (dialect.currentCondition && dialect.currentCondition.$options) {
        flags = dialect.currentCondition.$options;
      }

      // Convert simple patterns to LIKE for better performance
      const likePattern = convertRegexToLike(pattern);
      if (likePattern) {
        const valueParam = dialect.builder._pushValue(likePattern);
        if (flags.includes('i')) {
          return `LOWER(${field}) LIKE LOWER(${valueParam})`;
        }
        return `${field} LIKE ${valueParam}`;
      }

      // MSSQL doesn't have native regex, fall back to LIKE with wildcards
      const likeApproximation = pattern
        .replace(/\\\./g, '.') // Unescape dots
        .replace(/\.\*/g, '%') // .* -> %
        .replace(/\./g, '_') // . -> _
        .replace(/\+/g, '') // Remove + (not perfect)
        .replace(/\*/g, '%'); // * -> %

      const valueParam = dialect.builder._pushValue(likeApproximation);
      if (flags.includes('i')) {
        return `LOWER(${field}) LIKE LOWER(${valueParam})`;
      }
      return `${field} LIKE ${valueParam}`;
    },
  });

  // MSSQL-specific $nregex implementation
  dialect.operators.comparison.add('$nregex', {
    inversedOperator: '$regex',
    fn(field, value) {
      const regexCondition = dialect.operators.comparison.get('$regex').fn.call(this, field, value);
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

        if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
          // Handle nested operators
          for (const operator in subValue) {
            if (!Object.prototype.hasOwnProperty.call(subValue, operator)) {
              continue;
            }

            if (operator.startsWith('$')) {
              if (operator === '$regex') {
                const options = subValue.$options || '';
                const pattern = subValue[operator];
                const likePattern = convertRegexToLike(pattern);
                
                if (likePattern) {
                  const valueParam = dialect.builder._pushValue(likePattern);
                  if (options.includes('i')) {
                    conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE LOWER(JSON_VALUE(element.value, '$.${key}')) LIKE LOWER(${valueParam}))`);
                  } else {
                    conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') LIKE ${valueParam})`);
                  }
                } else {
                  // Fallback for complex patterns
                  const likeApproximation = pattern
                    .replace(/\\\./g, '.')
                    .replace(/\.\*/g, '%')
                    .replace(/\./g, '_')
                    .replace(/\+/g, '')
                    .replace(/\*/g, '%');
                  const valueParam = dialect.builder._pushValue(likeApproximation);
                  if (options.includes('i')) {
                    conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE LOWER(JSON_VALUE(element.value, '$.${key}')) LIKE LOWER(${valueParam}))`);
                  } else {
                    conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') LIKE ${valueParam})`);
                  }
                }
              } else if (operator === '$exists') {
                if (subValue[operator]) {
                  conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') IS NOT NULL)`);
                } else {
                  conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') IS NULL)`);
                }
              } else if (operator === '$ne') {
                const valueParam = dialect.builder._pushValue(subValue[operator]);
                conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') != ${valueParam})`);
              }
            }
          }
        } else {
          // Direct value comparison
          const valueParam = dialect.builder._pushValue(subValue);
          conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(${field}) AS element WHERE JSON_VALUE(element.value, '$.${key}') = ${valueParam})`);
        }
      }

      if (conditions.length === 0) {
        return '1=1';
      }

      // Validate that field contains JSON
      const typeCheck = `ISJSON(${field}) = 1`;
      return `(${typeCheck} AND (${conditions.join(' AND ')}))`;
    },
  });

  // MSSQL-specific $size implementation
  dialect.operators.comparison.add('$size', {
    fn(field, value) {
      // Handle nested operators like { $gt: 0 }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const conditions = [];
        for (const operator in value) {
          if (!Object.prototype.hasOwnProperty.call(value, operator)) {
            continue;
          }
          if (operator.startsWith('$')) {
            const lengthExpression = `(SELECT COUNT(*) FROM OPENJSON(${field}))`;
            const operatorImpl = dialect.operators.comparison.get(operator);
            if (operatorImpl) {
              let condition;
              if (typeof operatorImpl === 'function') {
                const temporaryField = lengthExpression.replaceAll('"', '');
                condition = operatorImpl.call(dialect, temporaryField, value[operator]);
                condition = condition.replaceAll(dialect.wrapIdentifier(temporaryField), lengthExpression);
              } else if (operatorImpl.fn) {
                const temporaryField = lengthExpression.replaceAll('"', '');
                condition = operatorImpl.fn.call(dialect, temporaryField, value[operator]);
                condition = condition.replaceAll(dialect.wrapIdentifier(temporaryField), lengthExpression);
              }
              if (condition) {
                conditions.push(condition);
              }
            }
          }
        }
        return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
      }
      
      // Simple size comparison
      const valueParam = dialect.builder._pushValue(value);
      return `(SELECT COUNT(*) FROM OPENJSON(${field})) = ${valueParam}`;
    },
  });

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
      if (typeof value === 'object' && value !== null) {
        const conditions = [];
        for (const operator in value) {
          if (!Object.prototype.hasOwnProperty.call(value, operator)) {
            continue;
          }
          
          if (operator === '$regex') {
            const options = value.$options || '';
            const pattern = value[operator];
            const likePattern = convertRegexToLike(pattern);
            
            if (likePattern) {
              const valueParam = dialect.builder._pushValue(likePattern);
              if (options.includes('i')) {
                conditions.push(`NOT (LOWER(${field}) LIKE LOWER(${valueParam}))`);
              } else {
                conditions.push(`NOT (${field} LIKE ${valueParam})`);
              }
            }
          } else if (operator === '$elemMatch') {
            const elemMatchCondition = dialect.operators.comparison.get('$elemMatch').fn.call(this, field, value[operator]);
            conditions.push(`NOT (${elemMatchCondition})`);
          }
        }
        return conditions.join(' AND ');
      } else {
        const valueParam = dialect.builder._pushValue(value);
        return `${field} != ${valueParam}`;
      }
    },
  });

  // $options operator (handled by $regex, but registered to avoid errors)
  dialect.operators.comparison.add('$options', {
    fn() {
      return '';
    },
  });
};

