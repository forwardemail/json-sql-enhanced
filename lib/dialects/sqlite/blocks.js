const objectUtils = require('../../utils/object.js');

const removeTopBrackets = function (condition) {
  if (
    condition.length > 0
    && condition[0] === '('
    && condition.at(-1) === ')'
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
  return array.map(iteratee);
}

function keys(object) {
  return Object.keys(object);
}

function values(object) {
  return Object.values(object);
}

function each(collection, iteratee) {
  if (isArray(collection)) {
    collection.forEach(iteratee);
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

function compact(array) {
  return array.filter(Boolean);
}

module.exports = function (dialect) {
  dialect.blocks.add('distinct', () => 'distinct');

  dialect.blocks.add('fields', parameters => {
    let fields = parameters.fields || {};

    if (!isObject(fields)) {
      throw new TypeError(
        'Invalid `fields` property type "' + typeof fields + '"',
      );
    }

    if (isEmpty(fields)) {
      return '*';
    }

    // If fields is array: ['a', {b: 'c'}, {name: '', table: 't', alias: 'r'}]
    if (isArray(fields)) {
      fields = map(fields, field => {
        if (
          objectUtils.isSimpleValue(field)
          || isTerm(field)
          || has(field, 'name')
        ) {
          // If field has simple type or is field object: {name: '', table: 't', alias: 'r'}
          return dialect.buildBlock('term', {term: field, type: 'field'});
        }

        // If field is object: {b: 'c'}
        return map(keys(field), key => {
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
    return map(keys(fields), key => {
      const value = fields[key];
      const term = dialect.buildBlock('term', {term: value, type: 'field'});
      return term + ' ' + dialect.wrapIdentifier(key);
    }).join(', ');
  });

  dialect.blocks.add('table', parameters => {
    let {table} = parameters;

    if (!isString(table)) {
      throw new TypeError(
        'Invalid `table` property type "' + typeof table + '"',
      );
    }

    table = dialect.wrapIdentifier(table);

    return table;
  });

  dialect.blocks.add('condition', parameters => {
    const {condition} = parameters;

    if (isUndefined(condition)) {
      return '';
    }

    if (!isObject(condition)) {
      throw new TypeError(
        'Invalid `condition` property type "' + typeof condition + '"',
      );
    }

    return 'where ' + dialect.buildCondition(condition);
  });

  dialect.blocks.add('modifier', parameters => {
    const {modifier} = parameters;

    if (!isObject(modifier)) {
      throw new TypeError(
        'Invalid `modifier` property type "' + typeof modifier + '"',
      );
    }

    const modifierParts = [];

    each(modifier, (value, key) => {
      const modifierPart
        = dialect.wrapIdentifier(key)
        + ' = '
        + dialect.buildBlock('term', {term: value, type: 'value'});

      modifierParts.push(modifierPart);
    });

    return 'set ' + modifierParts.join(', ');
  });

  dialect.blocks.add('join', parameters => {
    let {join} = parameters;

    if (isUndefined(join)) {
      return '';
    }

    if (!isArray(join)) {
      join = [join];
    }

    return map(join, joinItem =>
      dialect.buildTemplate('joinItem', joinItem),
    ).join(' ');
  });

  dialect.blocks.add('group', parameters => {
    let {group} = parameters;

    if (isUndefined(group)) {
      return '';
    }

    if (isString(group)) {
      group = [group];
    }

    if (!isArray(group)) {
      throw new TypeError(
        'Invalid `group` property type "' + typeof group + '"',
      );
    }

    return (
      'group by '
      + map(group, groupItem =>
        dialect.buildBlock('term', {term: groupItem, type: 'field'}),
      ).join(', ')
    );
  });

  dialect.blocks.add('sort', parameters => {
    let {sort} = parameters;

    if (isUndefined(sort)) {
      return '';
    }

    if (isString(sort)) {
      sort = [sort];
    }

    if (isArray(sort)) {
      return (
        'order by '
        + map(sort, sortItem => {
          if (isString(sortItem)) {
            return dialect.buildBlock('term', {
              term: sortItem,
              type: 'field',
            });
          }

          if (isObject(sortItem)) {
            return map(keys(sortItem), key => {
              const direction = sortItem[key];
              const field = dialect.buildBlock('term', {
                term: key,
                type: 'field',
              });

              return field + ' ' + direction;
            }).join(', ');
          }

          throw new TypeError(
            'Invalid `sort` array item type "' + typeof sortItem + '"',
          );
        }).join(', ')
      );
    }

    if (isObject(sort)) {
      return (
        'order by '
        + map(keys(sort), key => {
          const direction = sort[key];
          const field = dialect.buildBlock('term', {
            term: key,
            type: 'field',
          });

          return field + ' ' + direction;
        }).join(', ')
      );
    }

    throw new TypeError('Invalid `sort` property type "' + typeof sort + '"');
  });

  dialect.blocks.add('limit', parameters => {
    const {limit} = parameters;

    if (isUndefined(limit)) {
      return '';
    }

    return 'limit ' + limit;
  });

  dialect.blocks.add('offset', parameters => {
    const {offset} = parameters;

    if (isUndefined(offset)) {
      return '';
    }

    return 'offset ' + offset;
  });

  dialect.blocks.add('from', parameters => {
    let {from} = parameters;

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
      'from '
      + map(from, fromItem => {
        if (isString(fromItem)) {
          return dialect.wrapIdentifier(fromItem);
        }

        return dialect.buildTemplate('fromItem', fromItem);
      }).join(', ')
    );
  });

  dialect.blocks.add('having', parameters => {
    const {having} = parameters;

    if (isUndefined(having)) {
      return '';
    }

    if (!isObject(having)) {
      throw new TypeError(
        'Invalid `having` property type "' + typeof having + '"',
      );
    }

    return 'having ' + dialect.buildCondition(having);
  });

  dialect.blocks.add('values', parameters => {
    let {values} = parameters;

    if (!isArray(values)) {
      values = [values];
    }

    const valuesArray = map(values, valuesItem => {
      if (isObject(valuesItem) && !isArray(valuesItem)) {
        const valuesItemArray = map(keys(valuesItem), key => {
          const value = valuesItem[key];
          return dialect.builder._pushValue(value);
        });

        return '(' + valuesItemArray.join(', ') + ')';
      }

      throw new TypeError(
        'Invalid `values` array item type "' + typeof valuesItem + '"',
      );
    });

    const fields = keys(values[0]);
    const wrappedFields = map(fields, field => dialect.wrapIdentifier(field));

    return (
      '(' + wrappedFields.join(', ') + ') values ' + valuesArray.join(', ')
    );
  });

  dialect.blocks.add('or', parameters => {
    const {or} = parameters;

    if (isUndefined(or)) {
      return '';
    }

    return 'or ' + or;
  });

  dialect.blocks.add('returning', parameters => {
    let {returning} = parameters;

    if (isUndefined(returning)) {
      return '';
    }

    if (!isObject(returning)) {
      throw new TypeError(
        'Invalid `returning` property type "' + typeof returning + '"',
      );
    }

    if (isEmpty(returning)) {
      return 'returning *';
    }

    // If returning is array: ['a', {b: 'c'}, {name: '', table: 't', alias: 'r'}]
    if (isArray(returning)) {
      returning = map(returning, field => {
        if (
          objectUtils.isSimpleValue(field)
          || isTerm(field)
          || has(field, 'name')
        ) {
          // If field has simple type or is field object: {name: '', table: 't', alias: 'r'}
          return dialect.buildBlock('term', {term: field, type: 'field'});
        }

        // If field is object: {b: 'c'}
        return map(keys(field), key => {
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
      'returning '
      + map(keys(returning), key => {
        const value = returning[key];
        const term = dialect.buildBlock('term', {term: value, type: 'field'});
        return term + ' ' + dialect.wrapIdentifier(key);
      }).join(', ')
    );
  });

  dialect.blocks.add('with', parameters => {
    let withClause = parameters.with;

    if (isUndefined(withClause)) {
      return '';
    }

    if (!isArray(withClause)) {
      withClause = [withClause];
    }

    return (
      'with '
      + map(withClause, withItem =>
        dialect.buildTemplate('withItem', withItem),
      ).join(', ')
    );
  });

  dialect.blocks.add('withRecursive', parameters => {
    let {withRecursive} = parameters;

    if (isUndefined(withRecursive)) {
      return '';
    }

    if (!isArray(withRecursive)) {
      withRecursive = [withRecursive];
    }

    return (
      'with recursive '
      + map(withRecursive, withItem =>
        dialect.buildTemplate('withItem', withItem),
      ).join(', ')
    );
  });

  dialect.blocks.add('queries', parameters => {
    const {queries} = parameters;

    if (!isArray(queries)) {
      throw new TypeError(
        'Invalid `queries` property type "' + typeof queries + '"',
      );
    }

    return map(queries, query => {
      if (isObject(query)) {
        return '(' + dialect.buildQuery(query) + ')';
      }

      throw new TypeError(
        'Invalid `queries` array item type "' + typeof query + '"',
      );
    }).join(' union ');
  });

  dialect.blocks.add('alias', parameters => {
    const {alias} = parameters;

    if (isUndefined(alias)) {
      return '';
    }

    if (isString(alias)) {
      return 'as ' + dialect.wrapIdentifier(alias);
    }

    if (isObject(alias)) {
      return (
        'as '
        + map(keys(alias), key => {
          const value = alias[key];
          return dialect.buildBlock('term', {term: value, type: 'field'});
        }).join(', ')
      );
    }

    throw new TypeError('Invalid `alias` property type "' + typeof alias + '"');
  });

  dialect.blocks.add('on', parameters => {
    const {on} = parameters;

    if (isUndefined(on)) {
      return '';
    }

    if (!isObject(on)) {
      throw new TypeError('Invalid `on` property type "' + typeof on + '"');
    }

    return 'on ' + removeTopBrackets(dialect.buildCondition(on));
  });

  dialect.blocks.add('term', parameters => {
    const {term} = parameters;
    const {type} = parameters;

    if (isUndefined(term)) {
      throw new TypeError('`term` property is not set');
    }

    if (isUndefined(type)) {
      throw new TypeError('`type` property is not set');
    }

    if (type === 'field') {
      if (objectUtils.isSimpleValue(term)) {
        return dialect.wrapIdentifier(term);
      }

      if (isObject(term)) {
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

          if (dialect.operators.fetching.has(termKey)) {
            return dialect.operators.fetching.get(termKey).fn(termValue);
          }

          throw new Error('Unknown term key "' + termKey + '"');
        }

        throw new TypeError('Invalid term object');
      }

      throw new TypeError('Invalid `term` property type "' + typeof term + '"');
    }

    if (type === 'value') {
      if (objectUtils.isSimpleValue(term)) {
        return dialect.builder._pushValue(term);
      }

      if (isObject(term)) {
        if (objectUtils.hasSome(term, termKeys)) {
          const termKey = keys(term)[0];
          const termValue = term[termKey];

          if (dialect.operators.fetching.has(termKey)) {
            return dialect.operators.fetching.get(termKey).fn(termValue);
          }

          throw new Error('Unknown term key "' + termKey + '"');
        }

        throw new TypeError('Invalid term object');
      }

      throw new TypeError('Invalid `term` property type "' + typeof term + '"');
    }

    if (type === 'func') {
      if (isString(term)) {
        return term;
      }

      if (isObject(term)) {
        if (objectUtils.hasSome(term, termKeys)) {
          const termKey = keys(term)[0];
          const termValue = term[termKey];

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
};
