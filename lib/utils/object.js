const {Buffer} = require('buffer');

// Check if object contains any of expected keys
exports.hasSome = function (object, keys) {
  const objectKeys = Object.keys(object);
  return keys.some(key => objectKeys.includes(key));
};

exports.isSimpleValue = function (value) {
  return (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
    || value === undefined
    || value instanceof RegExp
    || value instanceof Date
    || Buffer.isBuffer(value) // Issue #56: Support for Buffers
    || (value
      && typeof value === 'object'
      && typeof value.toHexString === 'function') // Issue #55: BSON ObjectId
    || (value
      && typeof value === 'object'
      && value.constructor !== Object
      && typeof value.toString === 'function') // Custom objects with toString
    || (value && typeof value === 'object' && Object.keys(value).length === 0) // Issue #57: Empty objects as null
  );
};

exports.isObjectObject = function (object) {
  return (
    typeof object === 'object'
    && object !== null
    && Object.prototype.toString.call(object) === '[object Object]'
  );
};
