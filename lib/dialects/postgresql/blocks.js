// Helper functions to replace underscore
function isObject(value) {
  return value !== null && typeof value === 'object';
}

function isArray(value) {
  return Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function keys(object) {
  return Object.keys(object);
}

function map(array, iteratee) {
  const result = [];
  for (const item of array) {
    result.push(iteratee(item));
  }

  return result;
}

function pick(object, keys) {
  const result = {};
  for (const key of keys) {
    if (key in object) {
      result[key] = object[key];
    }
  }

  return result;
}

module.exports = function (dialect) {
  const parentValueBlock = dialect.blocks.get('value');

  dialect.blocks.set('value', (parameters) => {
    const { value } = parameters;

    let result;
    if (isArray(value)) {
      if (value.length > 0) {
        result =
          'array[' +
          map(value, (item) => dialect.builder._pushValue(item)).join(', ') +
          ']';
      } else {
        result = dialect.builder._pushValue('{}');
      }
    } else if (isObject(value)) {
      result = dialect.builder._pushValue(JSON.stringify(value));
    } else {
      result = parentValueBlock(parameters);
    }

    return result;
  });

  dialect.blocks.add(
    'explain:options',
    (parameters) =>
      '(' +
      map(
        keys(
          pick(parameters.options, [
            'analyze',
            'verbose',
            'costs',
            'buffers',
            'timing',
            'format',
          ])
        ),
        (key) => {
          const value = parameters.options[key];
          return key + ' ' + value;
        }
      ).join(', ') +
      ')'
  );

  dialect.blocks.add('explain:analyze', () => 'analyze');

  dialect.blocks.add('explain:verbose', () => 'verbose');

  dialect.blocks.add('distinctOn', (parameters) => {
    let { distinctOn } = parameters;
    let result = '';

    if (isString(distinctOn)) {
      distinctOn = [distinctOn];
    }

    if (isArray(distinctOn)) {
      result = map(distinctOn, (distinctOnField) =>
        dialect.wrapIdentifier(distinctOnField)
      ).join(', ');
    }

    if (result) {
      result = 'distinct on (' + result + ')';
    }

    return result;
  });
};
