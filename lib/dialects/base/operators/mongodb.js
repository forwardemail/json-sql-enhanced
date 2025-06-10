'use strict';

// Simple and robust MongoDB operators implementation

function buildRegexCondition(dialect, field, pattern, options = '') {
  const fieldName = dialect.wrapIdentifier(field);
  const caseInsensitive = options.includes('i');

  // Try to convert to LIKE for better performance
  if (pattern.startsWith('^') && pattern.endsWith('$')) {
    // Exact match: ^text$ -> = 'text'
    const text = pattern.slice(1, -1);
    if (!/[.*+?^${}()|[\]\\]/.test(text)) {
      const value = dialect.builder._pushValue(text);
      if (caseInsensitive) {
        return `UPPER(${fieldName}) = UPPER(${value})`;
      }

      return `${fieldName} = ${value}`;
    }
  } else if (pattern.startsWith('^')) {
    // Starts with: ^text -> LIKE 'text%'
    const text = pattern.slice(1);
    if (!/[.*+?^${}()|[\]\\]/.test(text)) {
      const value = dialect.builder._pushValue(text + '%');
      if (caseInsensitive) {
        return `UPPER(${fieldName}) LIKE UPPER(${value})`;
      }

      return `${fieldName} LIKE ${value}`;
    }
  } else if (pattern.endsWith('$')) {
    // Ends with: text$ -> LIKE '%text'
    const text = pattern.slice(0, -1);
    if (!/[.*+?^${}()|[\]\\]/.test(text)) {
      const value = dialect.builder._pushValue('%' + text);
      if (caseInsensitive) {
        return `UPPER(${fieldName}) LIKE UPPER(${value})`;
      }

      return `${fieldName} LIKE ${value}`;
    }
  } else if (!/[.*+?^${}()|[\]\\]/.test(pattern)) {
    // Contains: text -> LIKE '%text%'
    const value = dialect.builder._pushValue('%' + pattern + '%');
    if (caseInsensitive) {
      return `UPPER(${fieldName}) LIKE UPPER(${value})`;
    }

    return `${fieldName} LIKE ${value}`;
  }

  // Fall back to regex
  const value = dialect.builder._pushValue(pattern);
  return `${fieldName} REGEXP ${value}`;
}

function buildExistsCondition(dialect, field, exists) {
  const fieldName = dialect.wrapIdentifier(field);
  if (exists) {
    return `${fieldName} IS NOT NULL`;
  }

  return `${fieldName} IS NULL`;
}

function buildSizeCondition(dialect, field, size) {
  const fieldName = dialect.wrapIdentifier(field);

  // Handle nested operators like { $gt: 0 }
  if (typeof size === 'object' && size !== null && !Array.isArray(size)) {
    const conditions = [];
    for (const operator in size) {
      if (!Object.prototype.hasOwnProperty.call(size, operator)) {
        continue;
      }

      if (operator.startsWith('$')) {
        let lengthExpression;
        switch (dialect.builder.options.dialect) {
          case 'postgresql': {
            lengthExpression = `jsonb_array_length(${fieldName})`;
            break;
          }

          case 'mysql': {
            lengthExpression = `JSON_LENGTH(${fieldName})`;
            break;
          }

          case 'mssql': {
            lengthExpression = `(SELECT COUNT(*) FROM OPENJSON(${fieldName}))`;
            break;
          }

          case 'sqlite': {
            lengthExpression = `json_array_length(${fieldName})`;
            break;
          }

          default: {
            lengthExpression = `LENGTH(${fieldName})`;
          }
        }

        const operatorImpl = dialect.operators.comparison.get(operator);
        if (operatorImpl) {
          let condition;
          if (typeof operatorImpl === 'function') {
            // Create a temporary field name for the length expression
            const temporaryField = lengthExpression.replaceAll('"', '');
            condition = operatorImpl.call(dialect, temporaryField, size[operator]);
            // Replace the temp field with the actual expression
            condition = condition.replaceAll(dialect.wrapIdentifier(temporaryField), lengthExpression);
          } else if (operatorImpl.fn) {
            const temporaryField = lengthExpression.replaceAll('"', '');
            condition = operatorImpl.fn.call(dialect, temporaryField, size[operator]);
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
  const sizeValue = dialect.builder._pushValue(size);

  switch (dialect.builder.options.dialect) {
    case 'postgresql': {
      return `jsonb_array_length(${fieldName}) = ${sizeValue}`;
    }

    case 'mysql': {
      return `JSON_LENGTH(${fieldName}) = ${sizeValue}`;
    }

    case 'mssql': {
      return `(SELECT COUNT(*) FROM OPENJSON(${fieldName})) = ${sizeValue}`;
    }

    case 'sqlite': {
      return `json_array_length(${fieldName}) = ${sizeValue}`;
    }

    default: {
      return `LENGTH(${fieldName}) = ${sizeValue}`;
    }
  }
}

function buildElementMatchCondition(dialect, field, conditions) {
  const fieldName = dialect.wrapIdentifier(field);

  // Simple implementation for now
  if (typeof conditions === 'object' && conditions !== null) {
    const subConditions = [];

    for (const key in conditions) {
      if (!Object.prototype.hasOwnProperty.call(conditions, key)) {
        continue;
      }

      const value = conditions[key];
      if (typeof value === 'object' && value !== null) {
        for (const operator in value) {
          if (!Object.prototype.hasOwnProperty.call(value, operator)) {
            continue;
          }

          switch (operator) {
            case '$regex': {
              const options = value.$options || '';
              const condition = buildRegexCondition(
                dialect,
                `json_extract(value, '$.${key}')`,
                value[operator],
                options,
              );
              subConditions.push(condition);

              break;
            }

            case '$exists': {
              const condition = buildExistsCondition(
                dialect,
                `json_extract(value, '$.${key}')`,
                value[operator],
              );
              subConditions.push(condition);

              break;
            }

            case '$ne': {
              const value_ = dialect.builder._pushValue(value[operator]);
              subConditions.push(`json_extract(value, '$.${key}') != ${value_}`);

              break;
            }
          // No default
          }
        }
      } else {
        const value_ = dialect.builder._pushValue(value);
        subConditions.push(`json_extract(value, '$.${key}') = ${value_}`);
      }
    }

    if (subConditions.length > 0) {
      return `EXISTS (SELECT 1 FROM json_each(${fieldName}) AS element WHERE ${subConditions.join(' AND ')})`;
    }
  }

  return '1=1';
}

module.exports = function (dialect) {
  // $regex operator with $options support
  dialect.operators.comparison.set('$regex', function (field, value) {
    // Check if there's an $options in the same condition
    const options = this.currentCondition && this.currentCondition.$options || '';
    return buildRegexCondition(this, field, value, options);
  });

  // Field-level $not operator
  dialect.operators.comparison.set('$not', function (field, value) {
    if (typeof value === 'object' && value !== null) {
      // Handle nested operators like { $not: { $regex: 'pattern' } }
      const conditions = [];
      for (const operator in value) {
        if (!Object.prototype.hasOwnProperty.call(value, operator)) {
          continue;
        }

        if (operator === '$regex') {
          const options = value.$options || '';
          const regexCondition = buildRegexCondition(this, field, value[operator], options);
          conditions.push(`NOT (${regexCondition})`);
        } else {
          const operatorImpl = this.operators.comparison.get(operator);
          if (operatorImpl) {
            let condition;
            if (typeof operatorImpl === 'function') {
              condition = operatorImpl.call(this, field, value[operator]);
            } else if (operatorImpl.fn) {
              condition = operatorImpl.fn.call(this, field, value[operator]);
            }

            if (condition) {
              conditions.push(`NOT (${condition})`);
            }
          }
        }
      }

      return conditions.join(' AND ');
    }

    // Simple negation
    const fieldName = this.wrapIdentifier(field);
    const value_ = this.builder._pushValue(value);
    return `${fieldName} != ${value_}`;
  });

  // $nregex operator (negated regex)
  dialect.operators.comparison.set('$nregex', function (field, value) {
    const options = this.currentCondition && this.currentCondition.$options || '';
    const regexCondition = buildRegexCondition(this, field, value, options);
    return `NOT (${regexCondition})`;
  });

  // $elemMatch operator
  dialect.operators.comparison.set('$elemMatch', function (field, conditions) {
    return buildElementMatchCondition(this, field, conditions);
  });

  // $size operator
  dialect.operators.comparison.set('$size', function (field, size) {
    return buildSizeCondition(this, field, size);
  });

  // $exists operator
  dialect.operators.comparison.set('$exists', function (field, exists) {
    return buildExistsCondition(this, field, exists);
  });

  // $options operator (handled by $regex, but registered to avoid errors)
  dialect.operators.comparison.set('$options', (field, options) =>
    // This is handled by $regex, just return empty string
    '',
  );
};

