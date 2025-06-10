'use strict';

// Helper functions to replace underscore
function isUndefined(value) {
  return value === undefined;
}

function isArray(value) {
  return Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFunction(value) {
  return typeof value === 'function';
}

function intersection(array1, array2) {
  return array1.filter(item => array2.includes(item));
}

function some(array, predicate) {
  return array.some(predicate);
}

const typeCheckers = {
  string: isString,
  number: isNumber,
  boolean: isBoolean,
  object: isObject,
  array: isArray,
  function: isFunction,
};

exports.requiredProp = function (type, parameters, propName) {
  if (isUndefined(parameters[propName])) {
    throw new TypeError(
      '`' + propName + '` property is not set in `' + type + '` clause',
    );
  }
};

exports.atLeastOneOfProps = function (type, parameters, expectedPropNames) {
  const propNames = intersection(Object.keys(parameters), expectedPropNames);

  if (propNames.length === 0) {
    throw new Error(
      'Neither `'
        + expectedPropNames.join('`, `')
        + '` properties are not set in `'
        + type
        + '` clause',
    );
  }
};

exports.onlyOneOfProps = function (type, parameters, expectedPropNames) {
  const propNames = intersection(Object.keys(parameters), expectedPropNames);

  if (propNames.length > 1) {
    throw new Error(
      'Wrong using `'
        + propNames.join('`, `')
        + '` properties together in `'
        + type
        + '` clause',
    );
  }
};

exports.propType = function (type, parameters, propName, expectedTypes) {
  if (isUndefined(parameters[propName])) {
    return;
  }

  const propValue = parameters[propName];

  if (!isArray(expectedTypes)) {
    expectedTypes = [expectedTypes];
  }

  const hasSomeType = some(expectedTypes, expectedType => {
    const checker = typeCheckers[expectedType.toLowerCase()];
    return checker ? checker(propValue) : false;
  });

  if (!hasSomeType) {
    throw new Error(
      '`'
        + propName
        + '` property should have '
        + (expectedTypes.length > 1 ? 'one of expected types:' : 'type')
        + ' "'
        + expectedTypes.join('", "')
        + '" in `'
        + type
        + '` clause',
    );
  }
};

exports.minPropLength = function (type, parameters, propName, length) {
  if (isUndefined(parameters[propName])) {
    return;
  }

  if (parameters[propName].length < length) {
    throw new Error(
      '`'
        + propName
        + '` property should not have length less than '
        + length
        + ' in `'
        + type
        + '` clause',
    );
  }
};

exports.propMatch = function (type, parameters, propName, regExp) {
  if (isUndefined(parameters[propName])) {
    return;
  }

  if (!parameters[propName].match(regExp)) {
    throw new Error(
      'Invalid `'
        + propName
        + '` property value "'
        + parameters[propName]
        + '" in `'
        + type
        + '` clause',
    );
  }
};

exports.customProp = function (type, parameters, propName, fn) {
  if (isUndefined(parameters[propName])) {
    return;
  }

  if (!fn(parameters[propName])) {
    throw new Error(
      'Invalid `'
        + propName
        + '` property value "'
        + parameters[propName]
        + '" in `'
        + type
        + '` clause',
    );
  }
};
