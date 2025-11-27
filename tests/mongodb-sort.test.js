/* eslint-disable camelcase */
const test = require('ava');
const {Builder} = require('../lib/index.js');

test('sort with MongoDB-style -1 (descending) in object format', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    sort: {created_at: -1},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});

test('sort with MongoDB-style 1 (ascending) in object format', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    sort: {created_at: 1},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" asc');
});

test('sort with string "-1" (descending) in object format', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    sort: {created_at: '-1'},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});

test('sort with string "1" (ascending) in object format', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    sort: {created_at: '1'},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" asc');
});

test('sort with multiple fields using MongoDB-style numeric values', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'table',
    sort: {a: 1, b: -1},
  });

  t.is(sql.query, 'select * from "table" order by "a" asc, "b" desc');
});

test('sort with string "desc" for backward compatibility', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    sort: {created_at: 'desc'},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});

test('sort with string "asc" for backward compatibility', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    sort: {created_at: 'asc'},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" asc');
});

test('sort with array format containing MongoDB-style numeric values', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'table',
    sort: [{a: -1}, {b: 1}],
  });

  t.is(sql.query, 'select * from "table" order by "a" desc, "b" asc');
});

test('sort with limit and offset using MongoDB-style -1', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    limit: 10,
    offset: 0,
    sort: {created_at: -1},
  });

  t.is(
    sql.query,
    'select * from "Messages" order by "created_at" desc limit 10 offset 0',
  );
});

test('sort with limit and offset using MongoDB-style 1', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    fields: ['*'],
    limit: 10,
    offset: 0,
    sort: {created_at: 1},
  });

  t.is(
    sql.query,
    'select * from "Messages" order by "created_at" asc limit 10 offset 0',
  );
});

test('sort with mixed string and numeric values', t => {
  const builder = new Builder();
  const sql = builder.build({
    type: 'select',
    table: 'table',
    sort: {a: 1, b: 'desc', c: -1, d: 'asc'},
  });

  t.is(
    sql.query,
    'select * from "table" order by "a" asc, "b" desc, "c" desc, "d" asc',
  );
});

test('sort with PostgreSQL dialect using MongoDB-style values', t => {
  const builder = new Builder({dialect: 'postgresql'});
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    sort: {created_at: -1},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});

test('sort with MySQL dialect using MongoDB-style values', t => {
  const builder = new Builder({dialect: 'mysql'});
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    sort: {created_at: -1},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});

test('sort with SQLite dialect using MongoDB-style values', t => {
  const builder = new Builder({dialect: 'sqlite'});
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    sort: {created_at: -1},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});

test('sort with MSSQL dialect using MongoDB-style values', t => {
  const builder = new Builder({dialect: 'mssql'});
  const sql = builder.build({
    type: 'select',
    table: 'Messages',
    sort: {created_at: -1},
  });

  t.is(sql.query, 'select * from "Messages" order by "created_at" desc');
});
