const {Buffer} = require('buffer');
const test = require('ava');
const jsonSql = require('../lib/index.js')();

// Simple test to verify basic functionality
test('Basic select query', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      name: 'John',
    },
  });

  t.true(result.query.includes('select'));
  t.true(result.query.includes('users'));
  t.true(result.query.includes('name'));
});

test('Basic insert query', t => {
  const result = jsonSql.build({
    type: 'insert',
    table: 'users',
    values: {
      name: 'John',
      age: 30,
    },
  });

  t.true(result.query.includes('insert'));
  t.true(result.query.includes('users'));
  t.true(result.query.includes('name'));
  t.true(result.query.includes('age'));
});

test('Basic comparison operators', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      age: {$gt: 18},
      status: {$in: ['active', 'pending']},
    },
  });

  t.true(result.query.includes('age'));
  t.true(result.query.includes('>'));
  t.true(result.query.includes('in'));
});

test('MongoDB $regex operator', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      name: {$regex: 'John'},
    },
  });

  t.true(result.query.includes('name'));
  t.true(
    result.query.includes('LIKE')
      || result.query.includes('John')
      || result.values.p1.includes('John'),
  );
});

test('MongoDB $not operator', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      status: {$not: 'inactive'},
    },
  });

  t.true(result.query.includes('status'));
  t.true(result.query.includes('!=') || result.query.includes('NOT'));
});

test('MongoDB $exists operator', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      email: {$exists: true},
    },
  });

  t.true(result.query.includes('email'));
  t.true(result.query.includes('IS NOT NULL'));
});

test('MongoDB $size operator', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      tags: {$size: 3},
    },
  });

  t.true(result.query.includes('tags'));
  t.true(result.query.includes('3'));
});

test('GitHub Issue #57 - Empty objects as null', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      metadata: {},
    },
  });

  t.true(result.query.includes('metadata'));
  t.true(result.query.includes('null'));
});

test('GitHub Issue #56 - Buffer support', t => {
  const buffer = Buffer.from('test', 'utf8');
  const result = jsonSql.build({
    type: 'insert',
    table: 'files',
    values: {
      data: buffer,
    },
  });

  t.true(result.query.includes('data'));
  t.true(typeof result.values.p1 === 'string');
});

test('GitHub Issue #55 - BSON ObjectId support', t => {
  const mockObjectId = {
    toHexString() {
      return '507f1f77bcf86cd799439011';
    },
  };

  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      _id: mockObjectId,
    },
  });

  t.true(result.query.includes('_id'));
  t.true(result.values.p1 === '507f1f77bcf86cd799439011');
});
