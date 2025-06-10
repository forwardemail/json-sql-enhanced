# MongoDB Operators and Enhanced Features

This document describes the new MongoDB-style operators and enhanced features added to this fork of json-sql.

## MongoDB Operators

### `$regex` - Pattern Matching

The `$regex` operator provides MongoDB-style regular expression pattern matching with intelligent optimization.

#### Basic Usage

```js
var jsonSql = require('json-sql-enhanced')();

// Simple patterns are automatically optimized to LIKE
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    name: { $regex: '^John' },
  },
});
// Result: name LIKE 'John%'
```

#### Pattern Optimization

The library automatically converts simple regex patterns to SQL LIKE patterns for better performance:

| Regex Pattern             | LIKE Pattern | Description |
| ------------------------- | ------------ | ----------- |
| `^text`                   | `text%`      | Starts with |
| `text$`                   | `%text`      | Ends with   |
| `^text$`                  | `text`       | Exact match |
| `text` (no special chars) | `%text%`     | Contains    |

#### Complex Patterns

Complex patterns fall back to native regex operators:

```js
// PostgreSQL: Uses ~ operator
{
  phone: {
    $regex: '^\\+1[0-9]{10}$';
  }
}
// → phone ~ '^\\+1[0-9]{10}$'

// MySQL: Uses REGEXP operator
{
  email: {
    $regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
  }
}
// → email REGEXP '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
```

#### Case Sensitivity

```js
// Case insensitive (PostgreSQL uses ILIKE)
{name: {$regex: {pattern: 'john', flags: 'i'}}}
// PostgreSQL: → name ILIKE '%john%'
// MySQL: → LOWER(name) LIKE LOWER('%john%')
```

### `$not` - Field-Level Negation

The `$not` operator provides field-level negation, different from the logical `$not`.

```js
// Field-level negation
{
  status: {
    $not: 'inactive';
  }
}
// → status != 'inactive'

// Works with other operators
{
  age: {
    $not: {
      $gt: 65;
    }
  }
}
// → NOT (age > 65)
```

### `$nregex` - Negated Regex

The `$nregex` operator is the negated version of `$regex`.

```js
{
  email: {
    $nregex: '^temp';
  }
}
// → NOT (email LIKE 'temp%')

{
  username: {
    $nregex: '^admin';
  }
}
// → NOT (username LIKE 'admin%')
```

### `$elemMatch` - Array Element Matching

The `$elemMatch` operator matches documents where at least one array element matches the specified criteria.

```js
// Basic usage
{tags: {$elemMatch: {category: 'tech'}}}

// With multiple conditions
{comments: {$elemMatch: {
    author: 'john',
    rating: {$gte: 4}
}}}
```

#### Dialect-Specific Implementation

- **PostgreSQL**: Uses JSONB functions and path queries
- **MySQL**: Uses JSON functions (MySQL 5.7+)
- **SQL Server**: Uses OPENJSON (SQL Server 2016+)
- **SQLite**: Uses JSON1 extension functions

## Enhanced Type Support

### Buffer Support (Issue #56)

Buffers are automatically converted to hexadecimal strings:

```js
var buffer = Buffer.from('hello world', 'utf8');

var sql = jsonSql.build({
  type: 'insert',
  table: 'files',
  values: {
    name: 'document.pdf',
    data: buffer,
  },
});

// buffer is converted to hex string automatically
console.log(sql.values.p2); // '68656c6c6f20776f726c64'
```

### BSON ObjectId Support (Issue #55)

Objects with a `toHexString()` method are automatically converted:

```js
var ObjectId = require('mongodb').ObjectId;
var objectId = new ObjectId('507f1f77bcf86cd799439011');

var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    _id: objectId,
  },
});

// ObjectId is converted using toHexString()
console.log(sql.values.p1); // '507f1f77bcf86cd799439011'
```

### Custom Object Support

Objects with custom `toString()` methods are supported:

```js
var customId = {
  constructor: function CustomType() {},
  toString: function () {
    return 'custom-id-12345';
  },
};

var sql = jsonSql.build({
  type: 'select',
  table: 'items',
  condition: {
    custom_id: customId,
  },
});

// Uses toString() method
console.log(sql.values.p1); // 'custom-id-12345'
```

### Null Object Support (Issue #57)

Empty objects are converted to NULL:

```js
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    metadata: {},
  },
});

// Empty object becomes NULL
// → where metadata = null
```

## Dialect-Specific Features

### PostgreSQL Enhancements

- **Native Regex**: Uses `~` (case-sensitive) and `~*` (case-insensitive) operators
- **ILIKE Support**: Case-insensitive LIKE operations
- **JSONB Functions**: Advanced JSON querying for `$elemMatch`
- **Array Operators**: Support for PostgreSQL array operations

```js
var jsonSql = require('json-sql-enhanced')({dialect: 'postgresql'});

// Uses PostgreSQL-specific features
{name: {$regex: {pattern: 'john', flags: 'i'}}}
// → name ~* 'john'

{tags: {$elemMatch: {type: 'tech'}}}
// → Uses jsonb_path_query for array matching
```

### MySQL Enhancements

- **REGEXP Operator**: Native regex support
- **JSON Functions**: Uses MySQL 5.7+ JSON functions
- **Case Handling**: Intelligent case-insensitive pattern matching

```js
var jsonSql = require('json-sql-enhanced')({ dialect: 'mysql' });

// Uses MySQL-specific features
{
  email: {
    $regex: '^[a-z]+@';
  }
}
// → email REGEXP '^[a-z]+@'

{
  tags: {
    $elemMatch: {
      active: true;
    }
  }
}
// → Uses JSON_CONTAINS for array matching
```

### SQL Server (MSSQL) Enhancements

- **Pattern Approximation**: Converts regex to LIKE patterns where possible
- **JSON Support**: Uses SQL Server 2016+ JSON functions
- **Graceful Fallbacks**: Handles limited regex support

```js
var jsonSql = require('json-sql-enhanced')({ dialect: 'mssql' });

// Pattern approximation
{
  name: {
    $regex: 'john.*';
  }
}
// → name LIKE 'john%'

{
  data: {
    $elemMatch: {
      status: 'active';
    }
  }
}
// → Uses OPENJSON for array queries
```

### SQLite Enhancements

- **Multi-Level Fallback**: LIKE → GLOB → REGEXP
- **JSON1 Extension**: Uses SQLite JSON functions
- **Pattern Conversion**: Intelligent regex-to-glob conversion

```js
var jsonSql = require('json-sql-enhanced')({ dialect: 'sqlite' });

// Uses SQLite-specific optimizations
{
  name: {
    $regex: '^john';
  }
}
// → name LIKE 'john%'

{
  tags: {
    $elemMatch: {
      category: 'tech';
    }
  }
}
// → Uses json_each for array iteration
```

## Performance Considerations

### Pattern Optimization

The library prioritizes performance by converting simple regex patterns to LIKE operations:

1. **LIKE Operations**: Fastest, uses database indexes effectively
2. **Native Regex**: Good performance, database-specific optimization
3. **Complex Patterns**: May require full table scans

### Indexing Recommendations

For optimal performance with the new operators:

```sql
-- For $regex with starts-with patterns
CREATE INDEX idx_name_prefix ON users(name varchar_pattern_ops);

-- For $elemMatch on JSON columns (PostgreSQL)
CREATE INDEX idx_tags_gin ON posts USING gin(tags);

-- For $elemMatch on JSON columns (MySQL)
CREATE INDEX idx_tags_json ON posts((CAST(tags AS JSON)));
```

### Query Planning

The library chooses the most efficient implementation based on:

1. **Pattern Complexity**: Simple patterns use LIKE
2. **Database Capabilities**: Leverages native features
3. **Fallback Strategy**: Graceful degradation when features unavailable

## Migration Guide

### From Original json-sql

This enhanced version is 100% backward compatible:

```js
// No changes needed to existing code
var jsonSql = require('json-sql-enhanced')();

// All existing queries work unchanged
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: { name: 'John', age: { $gt: 25 } },
});
```

### Adding New Operators

Simply start using the new operators in your conditions:

```js
// Add regex patterns
condition: {
    email: {$regex: '^[a-z]+@company\\.com$'},
    status: {$not: 'inactive'}
}

// Add array matching
condition: {
    tags: {$elemMatch: {category: 'tech', active: true}}
}
```

### Dialect Migration

Switch dialects to leverage database-specific optimizations:

```js
// Before (generic)
var jsonSql = require('json-sql-enhanced')();

// After (PostgreSQL optimized)
var jsonSql = require('json-sql-enhanced')({ dialect: 'postgresql' });
```

## Error Handling

### Invalid Patterns

```js
try {
  var sql = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      data: { complex: 'object' }, // Invalid object type
    },
  });
} catch (error) {
  console.log(error.message); // 'Wrong value type "object"'
}
```

### Unsupported Features

The library gracefully handles unsupported features:

```js
// Complex regex on SQLite without extension
{
  name: {
    $regex: '(?i)complex.*pattern';
  }
}
// Falls back to LIKE approximation with warning
```

## Testing

### Running Tests

```bash
# All enhanced features
npm test

# Specific test suites
./node_modules/.bin/mocha tests/mongodb-operators.js
./node_modules/.bin/mocha tests/mongodb-operators-dialects.js
./node_modules/.bin/mocha tests/github-issues.js
```

### Test Coverage

The enhanced version includes comprehensive tests:

- **MongoDB Operators**: 7 test cases covering all operators
- **Multi-Dialect Support**: 7 test cases across all dialects
- **GitHub Issues**: 7 test cases for all fixed issues
- **Integration**: Combined feature testing

### Custom Testing

```js
var jsonSql = require('json-sql-enhanced')({ dialect: 'postgresql' });

// Test regex optimization
var sql = jsonSql.build({
  type: 'select',
  table: 'test',
  condition: { name: { $regex: '^test' } },
});

console.log(sql.query); // Check generated SQL
console.log(sql.values); // Check parameter values
```
