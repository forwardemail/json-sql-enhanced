# GitHub Issues Fixed

This document details the GitHub issues that have been resolved in this enhanced fork of json-sql.

## Issue #57: Support for `null` Object type

**Original Issue**: [Feature request: Support for `null` Object type](https://github.com/2do2go/json-sql/issues/57)

**Problem**: The library didn't support `null` values, causing errors when trying to use null objects in queries.

**Solution**: Enhanced the `_pushValue` method and `isSimpleValue` function to properly handle null objects and empty objects.

### Implementation

```js
// In lib/builder.js _pushValue method
if (_.isUndefined(value) || _.isNull(value)) {
  return 'null';
}
// ... other type checks ...
else if (typeof value === 'object' && value !== null) {
  // Handle empty objects as null
  if (Object.keys(value).length === 0) {
    return 'null';
  }
  // ... other object handling
}
```

### Usage Examples

```js
// Empty objects are converted to NULL
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    metadata: {}, // Empty object → NULL
  },
});
// Result: select * from "users" where "metadata" = null;

// Explicit null values work as before
var sql2 = jsonSql.build({
  type: 'insert',
  table: 'users',
  values: {
    name: 'John',
    metadata: null, // Explicit null
  },
});
// Result: insert into "users" ("name", "metadata") values ($p1, null);
```

### Test Cases

```js
describe('Issue #57: Support for null Object type', function () {
  it('should handle empty objects as null', function () {
    var result = jsonSql.build({
      type: 'select',
      table: 'users',
      condition: { metadata: {} },
    });
    expect(result.query).to.equal(
      'select * from "users" where "metadata" = null;'
    );
  });
});
```

---

## Issue #56: Support for Buffers (BLOB/Hex)

**Original Issue**: [Feature request: Support for Buffers (BLOB/Hex)](https://github.com/2do2go/json-sql/issues/56)

**Problem**: The library threw an error when trying to use Buffer objects because they were treated as generic objects.

**Solution**: Added specific Buffer detection and automatic conversion to hexadecimal strings.

### Implementation

```js
// In lib/builder.js _pushValue method
else if (Buffer.isBuffer(value)) {
    // Issue #56: Support for Buffers (BLOB/Hex)
    var hexValue = value.toString('hex');
    if (this.options.separatedValues) {
        var placeholder = this._getPlaceholder();
        if (this.options.namedValues) {
            this._values[placeholder] = hexValue;
        } else {
            this._values.push(hexValue);
        }
        return this._wrapPlaceholder(placeholder);
    } else {
        return '\'' + hexValue + '\'';
    }
}

// In lib/utils/object.js isSimpleValue function
Buffer.isBuffer(value) ||  // Issue #56: Support for Buffers
```

### Usage Examples

```js
// Buffer in INSERT values
var buffer = Buffer.from('hello world', 'utf8');
var sql = jsonSql.build({
  type: 'insert',
  table: 'files',
  values: {
    name: 'document.txt',
    data: buffer, // Automatically converted to hex
  },
});
// Result: insert into "files" ("name", "data") values ($p1, $p2);
// Values: {p1: 'document.txt', p2: '68656c6c6f20776f726c64'}

// Buffer in WHERE conditions
var binaryData = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
var sql2 = jsonSql.build({
  type: 'select',
  table: 'files',
  condition: {
    data: binaryData,
  },
});
// Result: select * from "files" where "data" = $p1;
// Values: {p1: '48656c6c6f'}
```

### Test Cases

```js
describe('Issue #56: Support for Buffers (BLOB/Hex)', function () {
  it('should handle Buffer values', function () {
    var buffer = Buffer.from('hello world', 'utf8');
    var result = jsonSql.build({
      type: 'insert',
      table: 'files',
      values: { name: 'test.txt', data: buffer },
    });
    expect(result.values.p2).to.equal(buffer.toString('hex'));
  });

  it('should handle Buffer in conditions', function () {
    var buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    var result = jsonSql.build({
      type: 'select',
      table: 'files',
      condition: { data: buffer },
    });
    expect(result.values.p1).to.equal('48656c6c6f');
  });
});
```

---

## Issue #55: Support for conversion of BSON `ObjectId` to `String`

**Original Issue**: [Feature request: Support for conversion of BSON `ObjectId` to `String`](https://github.com/2do2go/json-sql/issues/55)

**Problem**: MongoDB BSON ObjectId values were not supported and would cause errors or be removed from queries.

**Solution**: Added detection for objects with `toHexString()` method and automatic conversion to string representation.

### Implementation

```js
// In lib/builder.js _pushValue method
else if (typeof value === 'object' && value !== null) {
    var stringValue;

    // Check for BSON ObjectId (has toHexString method)
    if (typeof value.toHexString === 'function') {
        stringValue = value.toHexString();
    }
    // Check for objects with toString that aren't plain objects
    else if (value.constructor !== Object && typeof value.toString === 'function') {
        stringValue = value.toString();
    }
    // ... handle conversion with placeholders
}

// In lib/utils/object.js isSimpleValue function
(value && typeof value === 'object' && typeof value.toHexString === 'function') ||  // Issue #55: BSON ObjectId
(value && typeof value === 'object' && value.constructor !== Object && typeof value.toString === 'function') ||  // Custom objects with toString
```

### Usage Examples

```js
// BSON ObjectId support
var ObjectId = require('mongodb').ObjectId;
var objectId = new ObjectId('507f1f77bcf86cd799439011');

var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    _id: objectId, // Automatically converted using toHexString()
  },
});
// Result: select * from "users" where "_id" = $p1;
// Values: {p1: '507f1f77bcf86cd799439011'}

// Custom objects with toString
var customId = {
  constructor: function CustomType() {},
  toString: function () {
    return 'custom-id-12345';
  },
};

var sql2 = jsonSql.build({
  type: 'select',
  table: 'items',
  condition: {
    custom_id: customId, // Uses toString() method
  },
});
// Result: select * from "items" where "custom_id" = $p1;
// Values: {p1: 'custom-id-12345'}
```

### Test Cases

```js
describe('Issue #55: Support for BSON ObjectId conversion', function () {
  it('should handle BSON ObjectId-like objects', function () {
    var mockObjectId = {
      toHexString: function () {
        return '507f1f77bcf86cd799439011';
      },
    };
    var result = jsonSql.build({
      type: 'select',
      table: 'users',
      condition: { _id: mockObjectId },
    });
    expect(result.values.p1).to.equal('507f1f77bcf86cd799439011');
  });

  it('should handle objects with custom toString', function () {
    var customObject = {
      constructor: function CustomType() {},
      toString: function () {
        return 'custom-value-123';
      },
    };
    var result = jsonSql.build({
      type: 'select',
      table: 'items',
      condition: { custom_id: customObject },
    });
    expect(result.values.p1).to.equal('custom-value-123');
  });
});
```

---

## Integration Testing

All three issues are tested together to ensure they work correctly in combination:

```js
describe('Integration with MongoDB operators', function () {
  it('should work with new operators and GitHub fixes', function () {
    var buffer = Buffer.from('test');
    var result = jsonSql.build({
      type: 'select',
      table: 'files',
      condition: {
        name: { $regex: '^test' }, // MongoDB operator
        data: { $not: buffer }, // MongoDB operator + Buffer support
        metadata: {}, // Null object support
      },
    });

    expect(result.query).to.include('LIKE'); // Regex optimization
    expect(result.query).to.include('!='); // $not operator
    expect(result.query).to.include('= null'); // Null object
    expect(result.values.p2).to.equal('test%'); // Pattern conversion
  });
});
```

## Backward Compatibility

All fixes maintain backward compatibility:

1. **Existing null handling**: Still works as before
2. **Existing object handling**: Plain objects still throw errors as expected
3. **Existing type support**: All original types continue to work

## Error Handling

The enhanced type system provides better error messages:

```js
// Plain objects still throw errors (as intended)
try {
  jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      metadata: { key: 'value' }, // Plain object with content
    },
  });
} catch (error) {
  console.log(error.message); // 'Wrong value type "object"'
}

// But empty objects are handled gracefully
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    metadata: {}, // Empty object → NULL
  },
});
// Works without error
```

## Performance Impact

The fixes have minimal performance impact:

1. **Type checking**: Added checks are performed in order of likelihood
2. **Buffer conversion**: `toString('hex')` is efficient for typical buffer sizes
3. **Object inspection**: `Object.keys().length` and method existence checks are fast
4. **Caching**: Converted values are cached in the values object

## Database Compatibility

All fixes work across all supported database dialects:

- **PostgreSQL**: Full support for all enhanced types
- **MySQL**: Full support for all enhanced types
- **SQL Server**: Full support for all enhanced types
- **SQLite**: Full support for all enhanced types
- **Base**: Generic implementation works everywhere
