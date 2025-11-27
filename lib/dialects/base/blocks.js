const objectUtils = require('../../utils/object.js');

const removeTopBrackets = function (condition) {
  if (
    condition.length > 0 &&
    condition[0] === '(' &&
    condition.at(-1) === ')'
  ) {
    condition = condition.slice(1, -1);
  }

  return condition;
};

const termKeys = ['select', 'query', 'field', 'value', 'func', 'expression'];
const isTerm = function (object) {
  return (
    objectUtils.isObjectObject(object) && objectUtils.hasSome(object, termKeys)
  );
};

// Helper functions to replace underscore
function isObject(value) {
  return value !== null && typeof value === 'object';
}

function isArray(value) {
  return Array.isArray(value);
}

function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (isArray(value) || typeof value === 'string') {
    return value.length === 0;
  }

  if (isObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function map(array, iteratee) {
  const result = [];
  for (const item of array) {
    result.push(iteratee(item));
  }

  return result;
}

function keys(object) {
  return Object.keys(object);
}

function each(collection, iteratee) {
  if (isArray(collection)) {
    for (const item of collection) {
      iteratee(item);
    }
  } else if (isObject(collection)) {
    for (const [key, value] of Object.entries(collection)) {
      iteratee(value, key);
    }
  }
}

function isString(value) {
  return typeof value === 'string';
}

function isUndefined(value) {
  return value === undefined;
}

module.exports = function (dialect) {
  dialect.blocks.add('distinct', (parameters) => {
    if (parameters.distinct) {
      return 'distinct';
    }

    return '';
  });

  dialect.blocks.add('fields', (parameters) => {
    let fields = parameters.fields || {};

    if (!isObject(fields)) {
      throw new TypeError(
        'Invalid `fields` property type "' + typeof fields + '"'
      );
    }

    if (isEmpty(fields)) {
      return '*';
    }

    // If fields is array: ['a', {b: 'c'}, {name: '', table: 't', alias: 'r'}]
    if (isArray(fields)) {
      fields = map(fields, (field) => {
        if (
          objectUtils.isSimpleValue(field) ||
          isTerm(field) ||
          has(field, 'name')
        ) {
          // If field has simple type or is field object: {name: '', table: 't', alias: 'r'}
          return dialect.buildBlock('term', { term: field, type: 'field' });
        }

        // If field is object: {b: 'c'}
        return map(keys(field), (key) => {
          const value = field[key];
          const term = dialect.buildBlock('term', {
            term: value,
            type: 'field',
          });
          return term + ' ' + dialect.wrapIdentifier(key);
        }).join(', ');
      });

      return fields.join(', ');
    }

    // If fields is object: {a: 'b', c: 'd'}
    return map(keys(fields), (key) => {
      const value = fields[key];
      const term = dialect.buildBlock('term', { term: value, type: 'field' });
      return term + ' ' + dialect.wrapIdentifier(key);
    }).join(', ');
  });

  dialect.blocks.add('table', (parameters) => {
    let { table } = parameters;

    if (!isString(table)) {
      throw new TypeError(
        'Invalid `table` property type "' + typeof table + '"'
      );
    }

    table = dialect.wrapIdentifier(table);

    return table;
  });

  dialect.blocks.add('condition', (parameters) => {
    const { condition } = parameters;

    if (isUndefined(condition) || condition === null) {
      return '';
    }

    if (!isObject(condition)) {
      throw new TypeError(
        'Invalid `condition` property type "' + typeof condition + '"'
      );
    }

    const conditionString = dialect.buildCondition(condition);
    return conditionString ? 'where ' + conditionString : '';
  });

  dialect.blocks.add('modifier', (parameters) => {
    const { modifier } = parameters;

    if (isUndefined(modifier) || modifier === null) {
      return '';
    }

    if (!isObject(modifier)) {
      throw new TypeError(
        'Invalid `modifier` property type "' + typeof modifier + '"'
      );
    }

    const modifierParts = [];

    each(modifier, (value, key) => {
      // Handle MongoDB operators
      if (key.startsWith('$')) {
        switch (key) {
          case '$set': {
            each(value, (setValue, setKey) => {
              const modifierPart =
                dialect.wrapIdentifier(setKey) +
                ' = ' +
                dialect.buildBlock('term', { term: setValue, type: 'value' });
              modifierParts.push(modifierPart);
            });

            break;
          }

          case '$inc': {
            each(value, (incValue, incKey) => {
              const modifierPart =
                dialect.wrapIdentifier(incKey) +
                ' = ' +
                dialect.wrapIdentifier(incKey) +
                ' + ' +
                dialect.buildBlock('term', { term: incValue, type: 'value' });
              modifierParts.push(modifierPart);
            });

            break;
          }

          case '$unset': {
            each(value, (unsetValue, unsetKey) => {
              const modifierPart = dialect.wrapIdentifier(unsetKey) + ' = NULL';
              modifierParts.push(modifierPart);
            });

            break;
          }

          default: {
            throw new Error('Unknown MongoDB operator "' + key + '"');
          }
        }
      } else {
        // Handle regular field assignments
        const modifierPart =
          dialect.wrapIdentifier(key) +
          ' = ' +
          dialect.buildBlock('term', { term: value, type: 'value' });
        modifierParts.push(modifierPart);
      }
    });

    return 'set ' + modifierParts.join(', ');
  });

  dialect.blocks.add('join', (parameters) => {
    let { join } = parameters;

    if (isUndefined(join)) {
      return '';
    }

    if (!isArray(join)) {
      join = [join];
    }

    return map(join, (joinItem) =>
      dialect.buildTemplate('joinItem', joinItem)
    ).join(' ');
  });

  dialect.blocks.add('group', (parameters) => {
    let { group } = parameters;

    if (isUndefined(group)) {
      return '';
    }

    if (isString(group)) {
      group = [group];
    }

    if (!isArray(group)) {
      throw new TypeError(
        'Invalid `group` property type "' + typeof group + '"'
      );
    }

    return (
      'group by ' +
      map(group, (groupItem) =>
        dialect.buildBlock('term', { term: groupItem, type: 'field' })
      ).join(', ')
    );
  });

  dialect.blocks.add('sort', (parameters) => {
    let { sort } = parameters;

    if (isUndefined(sort)) {
      return '';
    }

    if (isString(sort)) {
      sort = [sort];
    }

    if (isArray(sort)) {
      return (
        'order by ' +
        map(sort, (sortItem) => {
          if (isString(sortItem)) {
            return dialect.buildBlock('term', {
              term: sortItem,
              type: 'field',
            });
          }

          if (isObject(sortItem)) {
            return map(keys(sortItem), (key) => {
              let direction = sortItem[key];
              const field = dialect.buildBlock('term', {
                term: key,
                type: 'field',
              });

              // Convert MongoDB-style numeric sort to SQL keywords
              if (direction === 1 || direction === '1') {
                direction = 'asc';
              } else if (direction === -1 || direction === '-1') {
                direction = 'desc';
              }
              // Otherwise use the direction as-is (for 'asc', 'desc', 'ASC', 'DESC')

              return field + ' ' + direction;
            }).join(', ');
          }

          throw new TypeError(
            'Invalid `sort` array item type "' + typeof sortItem + '"'
          );
        }).join(', ')
      );
    }

    if (isObject(sort)) {
      return (
        'order by ' +
        map(keys(sort), (key) => {
          let direction = sort[key];
          const field = dialect.buildBlock('term', {
            term: key,
            type: 'field',
          });

          // Convert MongoDB-style numeric sort to SQL keywords
          if (direction === 1 || direction === '1') {
            direction = 'asc';
          } else if (direction === -1 || direction === '-1') {
            direction = 'desc';
          }
          // Otherwise use the direction as-is (for 'asc', 'desc', 'ASC', 'DESC')

          return field + ' ' + direction;
        }).join(', ')
      );
    }

    throw new TypeError('Invalid `sort` property type "' + typeof sort + '"');
  });

  dialect.blocks.add('limit', (parameters) => {
    const { limit } = parameters;

    if (isUndefined(limit)) {
      return '';
    }

    return 'limit ' + limit;
  });

  dialect.blocks.add('offset', (parameters) => {
    const { offset } = parameters;

    if (isUndefined(offset)) {
      return '';
    }

    return 'offset ' + offset;
  });

  dialect.blocks.add('from', (parameters) => {
    let { from } = parameters;

    if (isUndefined(from)) {
      return '';
    }

    if (isString(from)) {
      from = [from];
    }

    if (!isArray(from)) {
      throw new TypeError('Invalid `from` property type "' + typeof from + '"');
    }

    return (
      'from ' +
      map(from, (fromItem) => {
        if (isString(fromItem)) {
          return dialect.wrapIdentifier(fromItem);
        }

        return dialect.buildTemplate('fromItem', fromItem);
      }).join(', ')
    );
  });

  dialect.blocks.add('having', (parameters) => {
    const { having } = parameters;

    if (isUndefined(having)) {
      return '';
    }

    if (!isObject(having)) {
      throw new TypeError(
        'Invalid `having` property type "' + typeof having + '"'
      );
    }

    return 'having ' + dialect.buildCondition(having);
  });

  dialect.blocks.add('values', (parameters) => {
    let { values } = parameters;

    if (!isArray(values)) {
      values = [values];
    }

    const valuesArray = map(values, (valuesItem) => {
      if (isObject(valuesItem) && !isArray(valuesItem)) {
        const valuesItemArray = map(keys(valuesItem), (key) => {
          const value = valuesItem[key];
          return dialect.builder._pushValue(value);
        });

        return '(' + valuesItemArray.join(', ') + ')';
      }

      throw new TypeError(
        'Invalid `values` array item type "' + typeof valuesItem + '"'
      );
    });

    const fields = keys(values[0]);
    const wrappedFields = map(fields, (field) => dialect.wrapIdentifier(field));

    return (
      '(' + wrappedFields.join(', ') + ') values ' + valuesArray.join(', ')
    );
  });

  dialect.blocks.add('or', (parameters) => {
    const { or } = parameters;

    if (isUndefined(or)) {
      return '';
    }

    return 'or ' + or;
  });

  dialect.blocks.add('returning', (parameters) => {
    let { returning } = parameters;

    if (isUndefined(returning)) {
      return '';
    }

    if (!isObject(returning)) {
      throw new TypeError(
        'Invalid `returning` property type "' + typeof returning + '"'
      );
    }

    if (isEmpty(returning)) {
      return 'returning *';
    }

    // If returning is array: ['a', {b: 'c'}, {name: '', table: 't', alias: 'r'}]
    if (isArray(returning)) {
      returning = map(returning, (field) => {
        if (
          objectUtils.isSimpleValue(field) ||
          isTerm(field) ||
          has(field, 'name')
        ) {
          // If field has simple type or is field object: {name: '', table: 't', alias: 'r'}
          return dialect.buildBlock('term', { term: field, type: 'field' });
        }

        // If field is object: {b: 'c'}
        return map(keys(field), (key) => {
          const value = field[key];
          const term = dialect.buildBlock('term', {
            term: value,
            type: 'field',
          });
          return term + ' ' + dialect.wrapIdentifier(key);
        }).join(', ');
      });

      return 'returning ' + returning.join(', ');
    }

    // If returning is object: {a: 'b', c: 'd'}
    return (
      'returning ' +
      map(keys(returning), (key) => {
        const value = returning[key];
        const term = dialect.buildBlock('term', { term: value, type: 'field' });
        return term + ' ' + dialect.wrapIdentifier(key);
      }).join(', ')
    );
  });

  dialect.blocks.add('with', (parameters) => {
    let withClause = parameters.with;

    if (isUndefined(withClause)) {
      return '';
    }

    if (!isArray(withClause)) {
      withClause = [withClause];
    }

    return (
      'with ' +
      map(withClause, (withItem) =>
        dialect.buildTemplate('withItem', withItem)
      ).join(', ')
    );
  });

  dialect.blocks.add('withRecursive', (parameters) => {
    let { withRecursive } = parameters;

    if (isUndefined(withRecursive)) {
      return '';
    }

    if (!isArray(withRecursive)) {
      withRecursive = [withRecursive];
    }

    return (
      'with recursive ' +
      map(withRecursive, (withItem) =>
        dialect.buildTemplate('withItem', withItem)
      ).join(', ')
    );
  });

  dialect.blocks.add('queries', (parameters) => {
    const { queries } = parameters;

    if (!isArray(queries)) {
      throw new TypeError(
        'Invalid `queries` property type "' + typeof queries + '"'
      );
    }

    return map(queries, (query) => {
      if (isObject(query)) {
        return '(' + dialect.buildQuery(query) + ')';
      }

      throw new TypeError(
        'Invalid `queries` array item type "' + typeof query + '"'
      );
    }).join(' union ');
  });

  dialect.blocks.add('func', (parameters) => {
    let { func } = parameters;

    if (isString(func)) {
      func = { name: func };
    }

    if (!isObject(func)) {
      throw new TypeError('Invalid `func` property type "' + typeof func + '"');
    }

    if (!has(func, 'name')) {
      throw new Error('`func.name` property is required');
    }

    let args = '';
    if (isArray(func.args)) {
      args = map(func.args, (arg) =>
        dialect.buildBlock('term', { term: arg, type: 'value' })
      ).join(', ');
    }

    return func.name + '(' + args + ')';
  });

  dialect.blocks.add('expression', (parameters) => {
    let { expression } = parameters;

    if (isUndefined(expression)) {
      return '';
    }

    if (isString(expression)) {
      expression = { pattern: expression };
    }

    if (!isObject(expression)) {
      throw new TypeError(
        'Invalid `expression` property type "' + typeof expression + '"'
      );
    }

    if (!has(expression, 'pattern')) {
      throw new Error('`expression.pattern` property is required');
    }

    const values = expression.values || {};

    return expression.pattern
      .replaceAll(/{([a-z\d]+)}/gi, (fullMatch, block) => {
        if (!has(values, block)) {
          throw new Error(
            'Field `' + block + '` is required in `expression.values` property'
          );
        }

        return dialect.buildBlock('term', {
          term: values[block],
          type: 'value',
        });
      })
      .trim();
  });

  dialect.blocks.add('field', (parameters) => {
    let { field } = parameters;

    if (isString(field)) {
      field = { name: field };
    }

    if (!isObject(field)) {
      throw new TypeError(
        'Invalid `field` property type "' + typeof field + '"'
      );
    }

    if (!has(field, 'name')) {
      throw new Error('`field.name` property is required');
    }

    let result = dialect.buildBlock('name', { name: field.name });
    if (has(field, 'table')) {
      result =
        dialect.buildBlock('table', { table: field.table }) + '.' + result;
    }

    return result;
  });

  dialect.blocks.add('value', (parameters) => {
    let { value } = parameters;

    if (value instanceof RegExp) {
      value = value.source;
    }

    return dialect.builder._pushValue(value);
  });

  dialect.blocks.add('name', (parameters) =>
    dialect.wrapIdentifier(parameters.name)
  );

  dialect.blocks.add('alias', (parameters) => {
    const { alias } = parameters;

    if (isUndefined(alias)) {
      return '';
    }

    if (isString(alias)) {
      return 'as ' + dialect.wrapIdentifier(alias);
    }

    if (isObject(alias)) {
      return (
        'as ' +
        map(keys(alias), (key) => {
          const value = alias[key];
          return dialect.buildBlock('term', { term: value, type: 'field' });
        }).join(', ')
      );
    }

    throw new TypeError('Invalid `alias` property type "' + typeof alias + '"');
  });

  dialect.blocks.add('on', (parameters) => {
    const { on } = parameters;

    if (isUndefined(on)) {
      return '';
    }

    if (!isObject(on)) {
      throw new TypeError('Invalid `on` property type "' + typeof on + '"');
    }

    return 'on ' + removeTopBrackets(dialect.buildCondition(on));
  });

  // Helper function to handle term keys
  function handleTermKey(termKey, termValue, dialect) {
    if (termKey === 'func') {
      return dialect.buildBlock('func', { func: termValue });
    }

    if (termKey === 'expression') {
      return dialect.buildBlock('expression', { expression: termValue });
    }

    if (termKey === 'field') {
      return dialect.buildBlock('field', { field: termValue });
    }

    if (termKey === 'value') {
      return dialect.buildBlock('value', { value: termValue });
    }

    if (dialect.operators.fetching.has(termKey)) {
      return dialect.operators.fetching.get(termKey).fn(termValue);
    }

    throw new Error('Unknown term key "' + termKey + '"');
  }

  // Helper function to handle field type terms
  function handleFieldType(term, dialect) {
    if (objectUtils.isSimpleValue(term)) {
      return dialect.wrapIdentifier(term);
    }

    if (!isObject(term)) {
      throw new TypeError('Invalid term object');
    }

    // Handle expression objects
    if (has(term, 'expression')) {
      return dialect.buildExpression(term.expression);
    }

    if (has(term, 'name')) {
      let field = '';

      if (has(term, 'table')) {
        field += dialect.wrapIdentifier(term.table) + '.';
      }

      field += dialect.wrapIdentifier(term.name);

      if (has(term, 'alias')) {
        field += ' as ' + dialect.wrapIdentifier(term.alias);
      }

      return field;
    }

    if (objectUtils.hasSome(term, termKeys)) {
      const termKey = keys(term)[0];
      const termValue = term[termKey];
      return handleTermKey(termKey, termValue, dialect);
    }

    throw new TypeError('Invalid term object');
  }

  // Helper function to handle value type terms
  function handleValueType(term, dialect) {
    if (objectUtils.isSimpleValue(term)) {
      return dialect.builder._pushValue(term);
    }

    if (!isObject(term)) {
      throw new TypeError('Invalid term object');
    }

    // Handle expression objects
    if (has(term, 'expression')) {
      return dialect.buildExpression(term.expression);
    }

    if (objectUtils.hasSome(term, termKeys)) {
      const termKey = keys(term)[0];
      const termValue = term[termKey];
      return handleTermKey(termKey, termValue, dialect);
    }

    throw new TypeError('Invalid term object');
  }

  dialect.blocks.add('term', (parameters) => {
    const { term } = parameters;
    const { type } = parameters;

    if (isUndefined(term)) {
      throw new TypeError('`term` property is not set');
    }

    if (isUndefined(type)) {
      throw new TypeError('`type` property is not set');
    }

    if (type === 'field') {
      return handleFieldType(term, dialect);
    }

    if (type === 'value') {
      return handleValueType(term, dialect);
    }

    if (type === 'func') {
      if (isString(term)) {
        return term;
      }

      if (isObject(term)) {
        if (objectUtils.hasSome(term, termKeys)) {
          const termKey = keys(term)[0];
          const termValue = term[termKey];

          if (termKey === 'func') {
            return dialect.buildBlock('func', { func: termValue });
          }

          if (dialect.operators.fetching.has(termKey)) {
            return dialect.operators.fetching.get(termKey).fn(termValue);
          }

          throw new Error('Unknown term key "' + termKey + '"');
        }

        throw new TypeError('Invalid term object');
      }

      throw new TypeError('Invalid `term` property type "' + typeof term + '"');
    }

    if (type === 'expression') {
      if (isString(term)) {
        return term;
      }

      if (isObject(term)) {
        if (objectUtils.hasSome(term, termKeys)) {
          const termKey = keys(term)[0];
          const termValue = term[termKey];

          if (termKey === 'expression') {
            return dialect.buildBlock('expression', { expression: termValue });
          }

          if (dialect.operators.fetching.has(termKey)) {
            return dialect.operators.fetching.get(termKey).fn(termValue);
          }

          throw new Error('Unknown term key "' + termKey + '"');
        }

        throw new TypeError('Invalid term object');
      }

      throw new TypeError('Invalid `term` property type "' + typeof term + '"');
    }

    throw new TypeError('Unknown `type` property value "' + type + '"');
  });

  dialect.blocks.add('insert:values', (parameters) => {
    let { values } = parameters;

    if (!isArray(values)) {
      values = [values];
    }

    const fields =
      parameters.fields ||
      map(values, (row) => keys(row))
        .flat()
        .filter((value, index, array) => array.indexOf(value) === index);

    return dialect.buildTemplate('insertValues', {
      fields,
      values: map(values, (row) =>
        map(fields, (field) =>
          dialect.buildBlock('value', { value: row[field] })
        )
      ),
    });
  });

  dialect.blocks.add('insertValues:values', (parameters) =>
    map(parameters.values, (row) => '(' + row.join(', ') + ')').join(', ')
  );
};
