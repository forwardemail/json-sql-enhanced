# Documentation

## Table of contents

- [API](#api)
  - [Initialization](#initialization)
  - **[build(query)](#buildquery)**
  - [configure(options)](#configureoptions)
  - [setDialect(name)](#setdialectname)
- **[Queries](#queries)**
  - [type: 'select'](#type-select)
  - [type: 'insert'](#type-insert)
  - [type: 'update'](#type-update)
  - [type: 'remove'](#type-remove)
  - [type: 'union' | 'intersect' | 'except'](#type-union--intersect--except)
- **[Blocks](#blocks)**
- **[Condition operators](#condition-operators)**
- **🆕 [MongoDB Operators](#mongodb-operators)** ⭐
- **🆕 [Enhanced Features](#enhanced-features)** ⭐
- **🆕 [GitHub Issues Fixed](#github-issues-fixed)** ⭐

⭐ = New in Enhanced Fork

---

## 🆕 What's New in This Enhanced Fork

This enhanced version adds powerful MongoDB-style operators and fixes several GitHub issues:

### New MongoDB Operators

- **`$regex`** - Pattern matching with LIKE optimization
- **`$not`** - Field-level negation
- **`$nregex`** - Negated regex patterns
- **`$elemMatch`** - Array element matching

### Enhanced Type Support

- **Buffers** - Automatic hex conversion (Issue #56)
- **BSON ObjectIds** - Automatic string conversion (Issue #55)
- **Null Objects** - Empty objects → NULL (Issue #57)

### Multi-Dialect Optimizations

- **PostgreSQL**: Native regex (`~`, `~*`) + JSONB
- **MySQL**: REGEXP + JSON functions
- **SQL Server**: Pattern approximation + OPENJSON
- **SQLite**: LIKE/GLOB/REGEXP + JSON1

For detailed information, see:

- [MongoDB Operators Guide](./MONGODB-OPERATORS.md)
- [GitHub Issues Fixed](./GITHUB-ISSUES.md)
- [Complete Changelog](./CHANGELOG.md)

---

## API

### Initialization

To create new instance of json-sql builder you can use factory function:

```js
var jsonSql = require('json-sql')(options);
```

or create instance by class constructor:

```js
var jsonSql = new (require('json-sql').Builder)(options);
```

`options` are similar to [configure method options](#available-options).

---

### build(query)

Create sql query from mongo-style query object.

`query` is a json object that has required property `type` and a set of query-specific properties. `type` property determines the type of query. List of available values of `type` property you can see at [Queries section](#queries).

Returns object with properties:

| Property            | Description                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| `query`             | SQL query string                                                                      |
| `value`             | Array or object with values.<br>Exists only if `separatedValues = true`.              |
| `prefixValues()`    | Method to get values with `valuesPrefix`.<br>Exists only if `separatedValues = true`. |
| `getValuesArray()`  | Method to get values as array.<br>Exists only if `separatedValues = true`.            |
| `getValuesObject()` | Method to get values as object.<br>Exists only if `separatedValues = true`.           |

---

### configure(options)

Set options of json-sql builder instance.

#### Available options

| Option name          | Default value | Description                                                                                                                                                                                         |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `separatedValues`    | `true`        | If `true` - create placeholder for each string value and put it value to result `values`.<br>If `false` - put string values into sql query without placeholder (potential threat of sql injection). |
| `namedValues`        | `true`        | If `true` - create hash of values with placeholders p1, p2, ...<br>If `false` - put all values into array.<br>Option is used if `separatedValues = true`.                                           |
| `valuesPrefix`       | `'$'`         | Prefix for values placeholders<br>Option is used if `namedValues = true`.                                                                                                                           |
| `dialect`            | `'base'`      | Active dialect. See setDialect for dialects list.                                                                                                                                                   |
| `wrappedIdentifiers` | `true`        | If `true` - wrap all identifiers with dialect wrapper (name -> "name").                                                                                                                             |
| `indexedValues`      | `true`        | If `true` - uses auto-generated id for values placeholders after the value prefix                                                                                                                   |

---

### setDialect(name)

Set active dialect, name can has value `'base'`, `'mssql'`, `'mysql'`, `'postgresql'` or `'sqlite'`.

---

## Queries

### type: 'select'

> [ [with](#with-withrecursive) | [withRecursive](#with-withrecursive) ]<br>
> [ [distinct](#distinct) ]<br>
> [ [fields](#fields) ]<br> >[table](#table) | [query](#query) | [select](#select) | [expression](#expression)<br>
> [ [alias](#alias) ]<br>
> [ [join](#join) ]<br>
> [ [condition](#condition) ]<br>
> [ [group](#group) ]<br>
> [ [sort](#sort) ]<br>
> [ [limit](#limit) ]<br>
> [ [offset](#offset) ]

**Example:**

```js
var sql = jsonSql.build({
    type: 'select',
    fields: ['a', 'b']
    table: 'table'
});

sql.query
// select "a", "b" from "table";
```

If `fields` is not specified in query, result fields is `*` (all columns of the selected rows).

**Example:**

```js
var sql = jsonSql.build({
  type: 'select',
  table: 'table',
});

sql.query;
// select * from "table";
```

---

### type: 'insert'

> [ [with](#with-withrecursive) | [withRecursive](#with-withrecursive) ]<br>
> [ [or](#or) ]<br> >[table](#table)<br> >[values](#values)<br>
> [ [condition](#condition) ]<br>
> [ [returning](#returning) ]

**Example:**

```js
var sql = jsonSql.build({
  type: 'insert',
  table: 'table',
  values: { a: 4 },
});

sql.query;
// insert into "table" ("a") values (4);
```

---

### type: 'update'

> [ [with](#with-withrecursive) | [withRecursive](#with-withrecursive) ]<br>
> [ [or](#or) ]<br> >[table](#table)<br> >[modifier](#modifier)<br>
> [ [condition](#condition) ]<br>
> [ [returning](#returning) ]

**Example:**

```js
var sql = jsonSql.build({
  type: 'update',
  table: 'table',
  modifier: { a: 5 },
});

sql.query;
// update "table" set a = 5;
```

---

### type: 'remove'

> [ [with](#with-withrecursive) | [withRecursive](#with-withrecursive) ]<br> >[table](#table)<br>
> [ [condition](#condition) ]<br>
> [ [returning](#returning) ]

**Example:**

```js
var sql = jsonSql.build({
  type: 'remove',
  table: 'table',
});

sql.query;
// delete from "table";
```

---

### type: 'union' | 'intersect' | 'except'

> [ [all](#all) ]<br>
> [ [with](#with-withrecursive) | [withRecursive](#with-withrecursive) ]<br> >[queries](#queries)<br>
> [ [sort](#sort) ]<br>
> [ [limit](#limit) ]<br>
> [ [offset](#offset) ]

**`type: 'union'` example:**

```js
var sql = jsonSql.build({
  type: 'union',
  queries: [
    { type: 'select', table: 'table1' },
    { type: 'select', table: 'table2' },
  ],
});

sql.query;
// (select * from "table1") union (select * from "table2");
```

**`type: 'intersect'` example:**

```js
var sql = jsonSql.build({
  type: 'intersect',
  queries: [
    { type: 'select', table: 'table1' },
    { type: 'select', table: 'table2' },
  ],
});

sql.query;
// (select * from "table1") intersect (select * from "table2");
```

**`type: 'except'` example:**

```js
var sql = jsonSql.build({
  type: 'except',
  queries: [
    { type: 'select', table: 'table1' },
    { type: 'select', table: 'table2' },
  ],
});

sql.query;
// (select * from "table1") except (select * from "table2");
```

---

## Blocks

Blocks are small chunks of query.

### with, withRecursive

Should be an `array` or an `object`.

If value is an `array`, each item of array should be an `object` and should conform the scheme:

> name<br>
> [ [fields](#fields) ]<br> >[query](#query) | [select](#select) | [expression](#expression)

**Example:**

```js
var sql = jsonSql.build({
  with: [
    {
      name: 'table',
      select: { table: 'withTable' },
    },
  ],
  table: 'table',
});

sql.query;
// with "table" as (select * from "withTable") select * from "table";
```

If value is an `object`, keys of object interpret as names and each value should be an `object` and should conform the scheme:

> [ name ]<br>
> [ [fields](#fields) ]<br> >[query](#query) | [select](#select) | [expression](#expression)

**Example:**

```js
var sql = jsonSql.build({
  with: {
    table: {
      select: { table: 'withTable' },
    },
  },
  table: 'table',
});

sql.query;
// with "table" as (select * from "withTable") select * from "table";
```

---

### distinct

Should be a `boolean`:

```
distinct: true
```

**Example:**

```js
var sql = jsonSql.build({
  distinct: true,
  table: 'table',
});

sql.query;
// select distinct * from "table";
```

---

### fields

Should be an `array` or an `object`.

If value is an `array`, each item interprets as [term block](#term).

**Example:**

```js
var sql = jsonSql.build({
  fields: ['a', { b: 'c' }, { table: 'd', name: 'e', alias: 'f' }, ['g']],
  table: 'table',
});

sql.query;
// select "a", "b" as "c", "d"."e" as "f", "g" from "table";
```

If value is an `object`, keys of object interpret as field names and each value should be an `object` and should conform the scheme:

> [ name ]<br>
> [ [table](#table) ]<br> >[ cast ]<br>
> [ [alias](#alias) ]

**Example:**

```js
var sql = jsonSql.build({
  fields: {
    a: 'b',
    d: { table: 'c', alias: 'e' },
  },
  table: 'table',
});

sql.query;
// select "a" as "b", "c"."d" as "e" from "table";
```

---

### term

Should be:

- a `string` - interprets as field name;
- another simple type or an `array` - interprets as value;
- an `object` - should conform the scheme:

> [query](#query) | [select](#select) | [field](#field) | [value](#value) | [func](#func) | [expression](#expression)<br> >[ cast ]<br>
> [ [alias](#alias) ]

---

### field

Should be a `string` or an `object`.

If value is a `string`:

```
field: 'fieldName'
```

**Example:**

```js
var sql = jsonSql.build({
  fields: [{ field: 'a' }],
  table: 'table',
});

sql.query;
// select "a" from "table";
```

If value is an `object` it should conform the scheme:

> name<br>
> [ [table](#table) ]

**Example:**

```js
var sql = jsonSql.build({
  fields: [{ field: { name: 'a', table: 'table' } }],
  table: 'table',
});

sql.query;
// select "table"."a" from "table";
```

---

### value

Can have any type.

**Example:**

```js
var sql = jsonSql.build({
  fields: [{ value: 5 }, { value: 'test' }],
  table: 'table',
});

sql.query;
// select 5, $p1 from "table";

sql.values;
// {p1: 'test'}
```

---

### table

Should be a `string`:

```
table: 'tableName'
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
});

sql.query;
// select * from "table";
```

---

### query

Should be an `object`. Value interprets as sub-query and process recursively with [build(query)](#buildquery) method.

**Example:**

```js
var sql = jsonSql.build({
  query: { type: 'select', table: 'table' },
});

sql.query;
// select * from (select * from "table");
```

---

### select

Should be an `object`. Value interprets as sub-select and process recursively with [build(query)](#buildquery) method.

**Example:**

```js
var sql = jsonSql.build({
  select: { table: 'table' },
});

sql.query;
// select * from (select * from "table");
```

---

### func

Should be a `string` or an `object`.

If value is a `string`:

```
func: 'random'
```

**Example:**

```js
var sql = jsonSql.build({
  fields: [{ func: 'random' }],
  table: 'table',
});

sql.query;
// select random() from "table";
```

If value is an `object` it should conform the scheme:

> name<br> >[ args ]

where `name` is a `string` name of function, `args` is an `array` that contains it arguments.

**Example:**

```js
var sql = jsonSql.build({
  fields: [
    {
      func: {
        name: 'sum',
        args: [{ field: 'a' }],
      },
    },
  ],
  table: 'table',
});

sql.query;
// select sum("a") from table;
```

---

### expression

Should be a `string` or an `object`.

If value is a `string`:

```
expression: 'random()'
```

**Example:**

```js
var sql = jsonSql.build({
  expression: 'generate_series(2, 4)',
});

sql.query;
// select * from generate_series(2, 4);
```

If value is an `object` it should conform the scheme:

> pattern<br> >[ values ]

where `pattern` is a `string` pattern with placeholders `{placeholderName}`, `values` is a hash that contains values for each `placeholderName`.

**Example:**

```js
var sql = jsonSql.build({
  expression: {
    pattern: 'generate_series({start}, {stop})',
    values: { start: 2, stop: 4 },
  },
});

sql.query;
// select * from generate_series(2, 4);
```

---

### alias

Should be a `string` or an `object`.

If value is a `string`:

```
alias: 'aliasName'
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  alias: 'alias',
});

sql.query;
// select * from "table" as "alias";
```

If value is an `object` it should conform the scheme:

> name<br> >[ columns ]

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  alias: { name: 'alias' },
});

sql.query;
// select * from "table" as "alias";
```

---

### join

Should be an `array` or an `object`.

If value is an `array`, each item of array should be an `object` and should conform the scheme:

> [ type ]<br> >[table](#table) | [query](#query) | [select](#select) | [expression](#expression)<br>
> [ [alias](#alias) ]<br> >[ on ]

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  join: [
    {
      type: 'right',
      table: 'joinTable',
      on: { 'table.a': 'joinTable.b' },
    },
  ],
});

sql.query;
// select * from "table" right join "joinTable" on "table"."a" = "joinTable"."b";
```

If value is an `object`, keys of object interpret as table names and each value should be an `object` and should conform the scheme:

> [ type ]<br>
> [ [table](#table) | [query](#query) | [select](#select) | [expression](#expression) ]<br>
> [ [alias](#alias) ]<br> >[ on ]

**Example:**

```js
var sql = jsonSql.build({
    table: 'table',
    join: {
        joinTable: {
            type: 'inner',
            on: {'table.a': 'joinTable.b'}
        }
    }]
});

sql.query
// select * from "table" inner join "joinTable" on "table"."a" = "joinTable"."b";
```

**Join with sub-select example:**

```js
var sql = jsonSql.build({
  table: 'table',
  join: [
    {
      select: { table: 'joinTable' },
      alias: 'joinTable',
      on: { 'table.a': 'joinTable.b' },
    },
  ],
});

sql.query;
// select * from "table" join (select * from "joinTable") as "joinTable" on "table"."a" = "joinTable"."b";
```

---

### condition

Should be an `array` or an `object`.

**`array` example:**

```js
var sql = jsonSql.build({
  table: 'table',
  condition: [{ a: { $gt: 1 } }, { b: { $lt: 10 } }],
});

sql.query;
// select * from "table" where "a" > 1 and "b" < 10;
```

**`object` example:**

```js
var sql = jsonSql.build({
  table: 'table',
  condition: {
    a: { $gt: 1 },
    b: { $lt: 10 },
  },
});

sql.query;
// select * from "table" where "a" > 1 and "b" < 10;
```

---

### group

Should be a `string` or an `array`.

If value is a `string`:

```
group: 'fieldName'
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  group: 'a',
});

sql.query;
// select * from "table" group by "a";
```

If value is an `array`:

```
group: ['fieldName1', 'fieldName2']
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  group: ['a', 'b'],
});

sql.query;
// select * from "table" group by "a", "b";
```

---

### sort

Should be a `string`, an `array` or an `object`.

If value is a `string`:

```
sort: 'fieldName'
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  sort: 'a',
});

sql.query;
// select * from "table" order by "a";
```

If value is an `array`:

```
sort: ['fieldName1', 'fieldName2']
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  sort: ['a', 'b'],
});

sql.query;
// select * from "table" order by "a", "b";
```

If value is an `object`:

```
sort: {
    fieldName1: 1,
    fieldName2: -1
}
```

**Example**:

```js
var sql = jsonSql.build({
  table: 'table',
  sort: { a: 1, b: -1 },
});

sql.query;
// select * from "table" order by "a" asc, "b" desc;
```

---

### limit

Should be a `number`.

```
limit: limitValue
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  limit: 5,
});

sql.query;
// select * from "table" limit 5;
```

---

### offset

Should be a `number`.

```
offset: offsetValue
```

**Example:**

```js
var sql = jsonSql.build({
  table: 'table',
  offset: 5,
});

sql.query;
// select * from "table" offset 5;
```

---

### or

Should be a `string`.

Available values: 'rollback', 'abort', 'replace', 'fail', 'ignore'.

```
or: 'orValue'
```

**Example:**

```js
var sql = jsonSql.build({
  type: 'insert',
  or: 'replace',
  table: 'table',
  values: { a: 5 },
});

sql.query;
// insert or replace into "table" ("a") values (5);
```

---

### values

Should be an `array` or an `object`.

If value is an `array`, each item should be an `object` and interprets as single inserted row where keys are field names and corresponding values are field values.

**Example:**

```js
var sql = jsonSql.build({
  type: 'insert',
  table: 'table',
  values: [
    { a: 5, b: 'text1' },
    { a: 6, b: 'text2' },
  ],
});

sql.query;
// insert into "table" ("a", "b") values (5, $p1), (6, $p2);

sql.values;
// {p1: 'text1', p2: 'text2'}
```

If value is an `object`, it interprets as single inserted row where keys are field names and corresponding values are field values.

**Example:**

```js
var sql = jsonSql.build({
  type: 'insert',
  table: 'table',
  values: { a: 5, b: 'text' },
});

sql.query;
// insert into "table" ("a", "b") values (5, $p1);

sql.values;
// {p1: 'text'}
```

Also you can specify fields array. If there no key in value object it value is `null`.

**Example:**

```js
var sql = jsonSql.build({
  type: 'insert',
  table: 'table',
  fields: ['a', 'b', 'c'],
  values: { c: 'text', b: 5 },
});

sql.query;
// insert into "table" ("a", "b", "c") values (null, 5, $p1);

sql.values;
// {p1: 'text'}
```

---

### modifier

Should be an `object`.

You can specify modifier operator.
Available operators: `$set`, `$inc`, `$dec`, `$mul`, `$div`, `$default`.

**Example:**

```js
var sql = jsonSql.build({
  type: 'update',
  table: 'table',
  modifier: {
    $set: { a: 5 },
    $default: { b: true },
    $inc: { c: 10 },
  },
});

sql.query;
// update "table" set "a" = 5, "b" = default, "c" = "c" + 10;
```

If modifier operator is not specified it uses default operator `$set`.

**Example:**

```js
var sql = jsonSql.build({
  type: 'update',
  table: 'table',
  modifier: { a: 5 },
});

sql.query;
// update "table" set "a" = 5;
```

---

### returning

Format is similar to [fields](#fields) block.

**Example:**

```js
var sql = jsonSql.build({
  type: 'insert',
  table: 'table',
  values: { a: 5 },
  returning: ['a'],
});

sql.query;
// insert into "table" ("a") values (5) returning "a";
```

---

### all

Should be a `boolean`.

**Example:**

```js
var sql = jsonSql.build({
  type: 'union',
  all: true,
  queries: [
    { type: 'select', table: 'table1' },
    { type: 'select', table: 'table2' },
  ],
});

sql.query;
// (select * from "table1") union all (select * from "table2");
```

---

### queries

Should be an `array` with minimum 2 items. Each item interprets as sub-query and process recursively with [build(query)](#buildquery) method.

**Example:**

```js
var sql = jsonSql.build({
  type: 'union',
  queries: [
    { type: 'select', table: 'table1' },
    { type: 'select', table: 'table2' },
  ],
});

sql.query;
// (select * from "table1") union (select * from "table2");
```

---

## Condition operators

### Standard Comparison Operators

| Operator | Description                        | Example                                    |
| -------- | ---------------------------------- | ------------------------------------------ |
| `$eq`    | Equal to                           | `{age: {$eq: 25}}` → `age = 25`            |
| `$ne`    | Not equal to                       | `{age: {$ne: 25}}` → `age != 25`           |
| `$gt`    | Greater than                       | `{age: {$gt: 25}}` → `age > 25`            |
| `$gte`   | Greater than or equal              | `{age: {$gte: 25}}` → `age >= 25`          |
| `$lt`    | Less than                          | `{age: {$lt: 25}}` → `age < 25`            |
| `$lte`   | Less than or equal                 | `{age: {$lte: 25}}` → `age <= 25`          |
| `$in`    | In array                           | `{status: {$in: ['active', 'pending']}}`   |
| `$nin`   | Not in array                       | `{status: {$nin: ['inactive', 'banned']}}` |
| `$like`  | SQL LIKE pattern                   | `{name: {$like: 'John%'}}`                 |
| `$nlike` | SQL NOT LIKE pattern               | `{name: {$nlike: 'temp%'}}`                |
| `$ilike` | Case-insensitive LIKE (PostgreSQL) | `{name: {$ilike: 'john%'}}`                |

### Logical Operators

| Operator | Description | Example                                          |
| -------- | ----------- | ------------------------------------------------ |
| `$and`   | Logical AND | `{$and: [{age: {$gt: 18}}, {status: 'active'}]}` |
| `$or`    | Logical OR  | `{$or: [{age: {$lt: 18}}, {status: 'minor'}]}`   |
| `$not`   | Logical NOT | `{$not: {age: {$lt: 18}}}`                       |

---

## 🆕 MongoDB Operators

### Pattern Matching Operators

#### `$regex` - Regular Expression Matching ⭐

Smart pattern matching with automatic LIKE optimization:

```js
// Simple patterns are optimized to LIKE
{
  name: {
    $regex: '^John';
  }
} // → name LIKE 'John%'
{
  email: {
    $regex: 'gmail$';
  }
} // → email LIKE '%gmail'
{
  city: {
    $regex: 'New';
  }
} // → city LIKE '%New%'

// Complex patterns use native regex
{
  phone: {
    $regex: '^\\+1[0-9]{10}$';
  }
} // → phone ~ '^\\+1[0-9]{10}$' (PostgreSQL)
```

**Pattern Optimization Table:**

| Regex Pattern             | LIKE Pattern | Description |
| ------------------------- | ------------ | ----------- |
| `^text`                   | `text%`      | Starts with |
| `text$`                   | `%text`      | Ends with   |
| `^text$`                  | `text`       | Exact match |
| `text` (no special chars) | `%text%`     | Contains    |

**Case Insensitive Matching:**

```js
// PostgreSQL uses ILIKE
{name: {$regex: {pattern: 'john', flags: 'i'}}}
// → name ILIKE '%john%'

// MySQL uses LOWER()
{name: {$regex: {pattern: 'john', flags: 'i'}}}
// → LOWER(name) LIKE LOWER('%john%')
```

#### `$nregex` - Negated Regular Expression ⭐

Negated version of `$regex`:

```js
{
  email: {
    $nregex: '^temp';
  }
} // → NOT (email LIKE 'temp%')
{
  username: {
    $nregex: '^admin';
  }
} // → NOT (username LIKE 'admin%')
```

### Field Operators

#### `$not` - Field-Level Negation ⭐

Field-level negation (different from logical `$not`):

```js
{
  status: {
    $not: 'inactive';
  }
} // → status != 'inactive'
{
  role: {
    $not: 'admin';
  }
} // → role != 'admin'
{
  age: {
    $not: {
      $gt: 65;
    }
  }
} // → NOT (age > 65)
```

### Array Operators

#### `$elemMatch` - Array Element Matching ⭐

Matches documents where at least one array element satisfies the criteria:

```js
// Basic usage
{tags: {$elemMatch: {category: 'tech'}}}

// Multiple conditions
{comments: {$elemMatch: {
    author: 'john',
    rating: {$gte: 4}
}}}

// Nested conditions
{products: {$elemMatch: {
    price: {$lt: 100},
    category: {$in: ['electronics', 'gadgets']}
}}}
```

**Dialect-Specific Implementation:**

- **PostgreSQL**: Uses JSONB path queries and `jsonb_path_exists()`
- **MySQL**: Uses `JSON_CONTAINS()` and `JSON_EXTRACT()`
- **SQL Server**: Uses `OPENJSON()` with `WITH` clause
- **SQLite**: Uses `json_each()` and subqueries

---

## 🆕 Enhanced Features

### Enhanced Type Support

#### Buffer Support (Issue #56 Fix) ⭐

Automatic conversion of Buffer objects to hexadecimal strings:

```js
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
```

#### BSON ObjectId Support (Issue #55 Fix) ⭐

Automatic conversion of BSON ObjectIds and custom objects:

```js
var ObjectId = require('mongodb').ObjectId;
var objectId = new ObjectId('507f1f77bcf86cd799439011');

var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    _id: objectId, // Automatically converted using toHexString()
  },
});

// Custom objects with toString()
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
```

#### Null Object Support (Issue #57 Fix) ⭐

Empty objects are converted to NULL:

```js
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: {
    metadata: {}, // Empty object → NULL
  },
});
// Result: select * from "users" where "metadata" = null;
```

### Multi-Dialect Optimizations

#### PostgreSQL Enhancements ⭐

```js
var jsonSql = require('json-sql-enhanced')({dialect: 'postgresql'});

// Native regex operators
{name: {$regex: 'pattern'}}           // → name ~ 'pattern'
{name: {$regex: {pattern: 'john', flags: 'i'}}} // → name ~* 'john'

// ILIKE for case-insensitive LIKE
{name: {$regex: {pattern: 'john', flags: 'i'}}} // → name ILIKE '%john%'

// JSONB functions for arrays
{tags: {$elemMatch: {type: 'tech'}}}  // → Uses jsonb_path_exists()
```

#### MySQL Enhancements ⭐

```js
var jsonSql = require('json-sql-enhanced')({dialect: 'mysql'});

// REGEXP operator
{email: {$regex: '^[a-z]+@'}}         // → email REGEXP '^[a-z]+@'

// JSON functions (MySQL 5.7+)
{tags: {$elemMatch: {active: true}}}  // → Uses JSON_CONTAINS()

// Case handling
{name: {$regex: {pattern: 'john', flags: 'i'}}} // → LOWER(name) LIKE LOWER('%john%')
```

#### SQL Server Enhancements ⭐

```js
var jsonSql = require('json-sql-enhanced')({ dialect: 'mssql' });

// Pattern approximation
{
  name: {
    $regex: 'john.*';
  }
} // → name LIKE 'john%'

// JSON support (SQL Server 2016+)
{
  data: {
    $elemMatch: {
      status: 'active';
    }
  }
} // → Uses OPENJSON()
```

#### SQLite Enhancements ⭐

```js
var jsonSql = require('json-sql-enhanced')({ dialect: 'sqlite' });

// Progressive fallback: LIKE → GLOB → REGEXP
{
  name: {
    $regex: '^john';
  }
} // → name LIKE 'john%'
{
  name: {
    $regex: 'jo?n';
  }
} // → name GLOB 'jo?n'
{
  name: {
    $regex: '[0-9]+';
  }
} // → name REGEXP '[0-9]+' (if extension available)

// JSON1 extension
{
  tags: {
    $elemMatch: {
      category: 'tech';
    }
  }
} // → Uses json_each()
```

---

## 🆕 GitHub Issues Fixed

This enhanced fork resolves several long-standing issues from the original repository:

### Issue #57: Support for `null` Object type ⭐

**Problem**: Library didn't handle null values properly  
**Solution**: Empty objects `{}` now convert to `NULL`

```js
// Before: Error or unexpected behavior
// After: Works correctly
{
  metadata: {
  }
} // → metadata = null
```

### Issue #56: Support for Buffers (BLOB/Hex) ⭐

**Problem**: Buffer objects caused errors  
**Solution**: Automatic hex conversion

```js
// Before: Error
// After: Works correctly
var buffer = Buffer.from('data');
{
  file_data: buffer;
} // → Converts to hex string
```

### Issue #55: Support for BSON ObjectId conversion ⭐

**Problem**: MongoDB ObjectIds not supported  
**Solution**: Automatic string conversion

```js
// Before: Error or removal from query
// After: Works correctly
var objectId = new ObjectId('507f1f77bcf86cd799439011');
{
  _id: objectId;
} // → Converts using toHexString()
```

For detailed information about these fixes, see [GitHub Issues Documentation](./GITHUB-ISSUES.md).

---

## Migration from Original json-sql

This enhanced version is **100% backward compatible**:

```js
// Before (original json-sql)
var jsonSql = require('json-sql')();

// After (enhanced version)
var jsonSql = require('json-sql-enhanced')();

// All existing code continues to work unchanged
var sql = jsonSql.build({
  type: 'select',
  table: 'users',
  condition: { name: 'John', age: { $gt: 25 } },
});
```

### Gradual Adoption

You can gradually adopt new features:

```js
// Start with existing queries
condition: {
    name: 'John',
    age: {$gt: 25}
}

// Add new operators as needed
condition: {
    name: {$regex: '^John'},      // New: Pattern matching
    status: {$not: 'inactive'},   // New: Field negation
    tags: {$elemMatch: {type: 'user'}}  // New: Array matching
}
```

---

## Performance Considerations

### Pattern Optimization ⭐

The library automatically optimizes patterns for performance:

1. **LIKE Operations**: Fastest, uses database indexes effectively
2. **Native Regex**: Good performance, database-specific optimization
3. **Complex Patterns**: May require full table scans

### Indexing Recommendations ⭐

```sql
-- For $regex with starts-with patterns
CREATE INDEX idx_name_prefix ON users(name varchar_pattern_ops);

-- For $elemMatch on JSON columns (PostgreSQL)
CREATE INDEX idx_tags_gin ON posts USING gin(tags);

-- For $elemMatch on JSON columns (MySQL)
CREATE INDEX idx_tags_json ON posts((CAST(tags AS JSON)));
```

---

For complete examples and advanced usage, see:

- [MongoDB Operators Guide](./MONGODB-OPERATORS.md)
- [GitHub Issues Fixed](./GITHUB-ISSUES.md)
- [Complete Changelog](./CHANGELOG.md)
