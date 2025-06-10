const { Buffer } = require('buffer');

const dialectsHash = {
  base: require('./dialects/base/index.js'),
  mssql: require('./dialects/mssql/index.js'),
  postgresql: require('./dialects/postgresql/index.js'),
  sqlite: require('./dialects/sqlite/index.js'),
  mysql: require('./dialects/mysql/index.js'),
};

const Builder = function (options) {
  this.configure(options);
};

module.exports = Builder;

Builder.prototype._reset = function () {
  if (this.options.separatedValues) {
    this._placeholderId = 1;
    this._values = this.options.namedValues ? {} : [];
  } else {
    delete this._placeholderId;
    delete this._values;
  }

  this._query = '';
};

Builder.prototype._getPlaceholder = function () {
  let placeholder = '';
  if (this.options.namedValues) {
    placeholder += 'p';
  }

  if (this.options.indexedValues) {
    placeholder += this._placeholderId++;
  }

  return placeholder;
};

Builder.prototype._wrapPlaceholder = function (name) {
  return this.options.valuesPrefix + name;
};

Builder.prototype._pushValue = function (value) {
  if (value === undefined || value === null) {
    return 'null';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'string' || value instanceof Date) {
    return this._handleStringOrDateValue(value);
  }

  if (Buffer.isBuffer(value)) {
    return this._handleBufferValue(value);
  }

  if (typeof value === 'object' && value !== null) {
    return this._handleObjectValue(value);
  }

  throw new Error('Wrong value type "' + typeof value + '"');
};

Builder.prototype._handleStringOrDateValue = function (value) {
  if (this.options.separatedValues) {
    const placeholder = this._getPlaceholder();

    if (this.options.namedValues) {
      this._values[placeholder] = value;
    } else {
      this._values.push(value);
    }

    return this._wrapPlaceholder(placeholder);
  }

  if (value instanceof Date) {
    value = value.toISOString();
  }

  return "'" + value + "'";
};

Builder.prototype._handleBufferValue = function (value) {
  const hexValue = value.toString('hex');
  if (this.options.separatedValues) {
    const placeholder = this._getPlaceholder();
    if (this.options.namedValues) {
      this._values[placeholder] = hexValue;
    } else {
      this._values.push(hexValue);
    }

    return this._wrapPlaceholder(placeholder);
  }

  return "'" + hexValue + "'";
};

Builder.prototype._handleObjectValue = function (value) {
  // Issue #55: Support for BSON ObjectId conversion to String
  // Issue #57: Support for null Object type
  let stringValue;

  // Handle null objects (objects that are explicitly null-like) first
  if (Object.keys(value).length === 0) {
    return 'null';
  }

  // Check for BSON ObjectId (has toHexString method)
  if (typeof value.toHexString === 'function') {
    stringValue = value.toHexString();
  } else if (
    value.constructor !== Object &&
    typeof value.toString === 'function'
  ) {
    // Check for objects with toString that aren't plain objects
    stringValue = value.toString();
  } else {
    // Still throw error for plain objects that can't be converted
    throw new Error('Wrong value type "' + typeof value + '"');
  }

  if (this.options.separatedValues) {
    const placeholder = this._getPlaceholder();
    if (this.options.namedValues) {
      this._values[placeholder] = stringValue;
    } else {
      this._values.push(stringValue);
    }

    return this._wrapPlaceholder(placeholder);
  }

  return "'" + stringValue + "'";
};

Builder.prototype.configure = function (options) {
  options = {
    separatedValues: true,
    namedValues: true,
    valuesPrefix: '$',
    dialect: 'base',
    wrappedIdentifiers: true,
    indexedValues: true,
    ...options,
  };

  if (options.namedValues && !options.indexedValues) {
    throw new Error(
      'namedValues option can not be used without indexedValues option'
    );
  }

  this.options = options;
  this.dialect = new dialectsHash[options.dialect](this);

  if (!this.dialect) {
    throw new Error('Unknown dialect "' + options.dialect + '"');
  }

  this._reset();

  return this;
};

Builder.prototype.setDialect = function (name) {
  this.options.dialect = name;
  this.dialect = new dialectsHash[name](this);

  if (!this.dialect) {
    throw new Error('Unknown dialect "' + name + '"');
  }

  return this;
};

Builder.prototype.build = function (query) {
  this._reset();

  this._query = this.dialect.buildQuery(query);

  const result = {
    query: this._query,
  };

  if (this.options.separatedValues) {
    result.values = this._values;

    result.prefixValues = () => {
      const prefixedValues = {};

      for (const key in this._values) {
        if (Object.prototype.hasOwnProperty.call(this._values, key)) {
          prefixedValues[this.options.valuesPrefix + key] = this._values[key];
        }
      }

      return prefixedValues;
    };

    result.getValuesArray = () => {
      if (this.options.namedValues) {
        const valuesArray = [];

        for (let i = 1; i <= Object.keys(this._values).length; i++) {
          const key = this.options.indexedValues ? 'p' + i : 'p';
          valuesArray.push(this._values[key]);
        }

        return valuesArray;
      }

      return this._values;
    };

    result.getValuesObject = () => {
      if (this.options.namedValues) {
        return this._values;
      }

      const valuesObject = {};

      for (let i = 0; i < this._values.length; i++) {
        const key = this.options.indexedValues ? 'p' + (i + 1) : 'p';
        valuesObject[key] = this._values[i];
      }

      return valuesObject;
    };
  }

  return result;
};
