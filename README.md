# JSON-SQL Enhanced - Modern Edition

**A powerful, modern fork of json-sql with comprehensive MongoDB operators and multi-dialect support**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![build status](https://github.com/forwardemail/json-sql-enhanced/actions/workflows/ci.yml/badge.svg)](https://github.com/forwardemail/json-sql-enhanced/actions/workflows/ci.yml)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![license](https://img.shields.io/github/license/forwardemail/json-sql-enhanced.svg)](LICENSE)

## 🚀 What's New in This Fork

This is a comprehensive modernization and enhancement of the original [json-sql](https://github.com/2do2go/json-sql) library, featuring:

### ✨ **Modern JavaScript & Tooling**

- **Node.js 18+ support** with modern ES features
- **Zero dependencies** - removed underscore.js, using native JavaScript
- **Modern development workflow** with Prettier, XO, ESLint
- **Ava test framework** replacing Mocha/Chai
- **Git hooks** with Husky, lint-staged, and commitlint
- **2-space indentation** throughout codebase

### 🔥 **Enhanced MongoDB Operators**

- **`$regex`** with `$options` support for case-insensitive pattern matching
- **`$size`** for array length queries
- **`$exists`** for field existence checks
- **`$elemMatch`** for complex array element matching
- **Field-level `$not`** for negation
- **Complex `$and`/`$or`** with nested logical operations

### 🗄️ **Multi-Dialect Optimization**

- **PostgreSQL**: Native `~`, `~*` operators, ILIKE, JSONB functions
- **MySQL**: REGEXP operator, JSON functions, case-insensitive handling
- **SQL Server**: Pattern approximation, OPENJSON for arrays
- **SQLite**: Progressive fallback (LIKE → GLOB → REGEXP), JSON1 support

### 🐛 **GitHub Issues Fixed**

- **#57**: Empty objects `{}` convert to `NULL`
- **#56**: Buffer support with automatic hex conversion
- **#55**: BSON ObjectId support with `toHexString()` method

## 📦 Installation

```bash
npm install json-sql-enhanced
```

## 🎯 Quick Start

```javascript
const jsonSql = require('json-sql-enhanced')();

// Basic query
const result = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    name: { $regex: 'John', $options: 'i' },
    age: { $gt: 18 },
    emails: { $size: { $gt: 0 } },
  },
});

console.log(result.query);
// Output: select * from "users" where "name" ILIKE $p1 and "age" > $p2 and JSON_LENGTH("emails") > $p3

console.log(result.values);
// Output: { p1: '%John%', p2: 18, p3: 0 }
```

## 🔍 MongoDB Operators

### **$regex with $options**

```javascript
// Case-insensitive pattern matching
{ fullName: { $regex: 'John', $options: 'i' } }
// → PostgreSQL: "fullName" ILIKE '%John%'
// → MySQL: LOWER("fullName") LIKE LOWER('%John%')
// → SQLite: "fullName" LIKE '%John%' COLLATE NOCASE

// Pattern optimization
{ name: { $regex: '^John' } }     // → "name" LIKE 'John%'
{ name: { $regex: 'Smith$' } }    // → "name" LIKE '%Smith'
{ name: { $regex: '^John$' } }    // → "name" = 'John'
```

### **$elemMatch for Arrays**

```javascript
// Complex array element matching
{
  emails: {
    $elemMatch: {
      value: { $regex: '@company\\.com$', $options: 'i' },
      type: 'work'
    }
  }
}
// → PostgreSQL: EXISTS(SELECT 1 FROM jsonb_array_elements("emails") elem WHERE ...)
// → MySQL: JSON_SEARCH("emails", 'one', '%@company.com%') IS NOT NULL
// → SQLite: EXISTS(SELECT 1 FROM json_each("emails") WHERE ...)
```

### **$size for Array Length**

```javascript
{
  tags: {
    $size: 3;
  }
} // → JSON_LENGTH("tags") = 3
{
  emails: {
    $size: {
      $gt: 0;
    }
  }
} // → JSON_LENGTH("emails") > 0
```

### **$exists for Field Presence**

```javascript
{
  email: {
    $exists: true;
  }
} // → "email" IS NOT NULL
{
  phone: {
    $exists: false;
  }
} // → "phone" IS NULL
```

### **Complex Logical Operations**

```javascript
{
  $and: [
    { age: { $gte: 18 } },
    {
      $or: [{ status: 'active' }, { emails: { $size: { $gt: 0 } } }],
    },
  ];
}
```

## 🌐 Multi-Dialect Support

```javascript
// PostgreSQL optimizations
const pgSql = require('json-sql-enhanced')({ dialect: 'postgresql' });

// MySQL optimizations
const mysqlSql = require('json-sql-enhanced')({ dialect: 'mysql' });

// SQLite optimizations
const sqliteSql = require('json-sql-enhanced')({ dialect: 'sqlite' });

// SQL Server support
const mssqlSql = require('json-sql-enhanced')({ dialect: 'mssql' });
```

## 🔄 Migration from Original json-sql

This fork is **100% backward compatible**. Simply replace your import:

```javascript
// Before
const jsonSql = require('json-sql')();

// After
const jsonSql = require('json-sql-enhanced')();

// All existing code works unchanged!
```

## 🧪 Example Queries

All these complex MongoDB-style queries are supported:

```javascript
// Case-insensitive regex with options
{ fullName: { $regex: 'John', $options: 'i' } }

// Array element matching with nested conditions
{
  emails: {
    $elemMatch: {
      value: { $regex: 'john@example\\.com', $options: 'i' }
    }
  }
}

// Complex logical operations
{
  $or: [
    { emails: { $exists: false } },
    { emails: { $size: 0 } }
  ]
}

// Negation with nested operators
{
  $not: {
    emails: {
      $elemMatch: { type: { $regex: '^WORK$', $options: 'i' } }
    }
  }
}

// Multiple conditions with $and
{
  $and: [
    {
      emails: {
        $elemMatch: { value: { $regex: '@example\\.com', $options: 'i' } }
      }
    },
    {
      emails: { $elemMatch: { value: { $regex: '^john', $options: 'i' } } }
    }
  ]
}
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📋 Requirements

- **Node.js 18+**
- **Modern JavaScript environment**

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original [json-sql](https://github.com/2do2go/json-sql) library by 2do2go
- MongoDB query syntax inspiration
- Modern JavaScript community for best practices

## 📚 Documentation

For detailed documentation, examples, and API reference, see the [docs](./docs) directory:

- [MongoDB Operators Guide](./docs/MONGODB-OPERATORS.md)
- [Multi-Dialect Support](./docs/README.md)
- [GitHub Issues Fixed](./docs/GITHUB-ISSUES.md)
- [Changelog](./docs/CHANGELOG.md)

---

**Made with ❤️ for the JavaScript community**
