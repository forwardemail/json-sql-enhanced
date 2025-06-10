const test = require('ava');
const jsonSql = require('../lib/index.js')();

// Test all the user's example queries
test('$regex with $options case insensitive', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$regex: 'John', $options: 'i'},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('LIKE') || result.query.includes('REGEXP'));
});

test('$elemMatch with nested $regex', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {
        $elemMatch: {
          value: {$regex: 'john@example\\.com', $options: 'i'},
        },
      },
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('EXISTS'));
});

test('$size operator', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {$size: 0},
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('LENGTH') || result.query.includes('json_array_length'));
});

test('$exists operator', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$exists: true, $nin: [null, '']},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('IS NOT NULL'));
});

test('$not with nested operators', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $not: {
        fullName: {$regex: 'John', $options: 'i'},
      },
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('not') || result.query.includes('NOT'));
});

test('Complex $or with $exists and $size', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $or: [
        {emails: {$exists: false}},
        {emails: {$size: 0}},
      ],
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('OR') || result.query.includes('or'));
});

test('Complex $and with multiple conditions', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $and: [
        {
          emails: {
            $elemMatch: {
              value: {$regex: '@example\\.com', $options: 'i'},
            },
          },
        },
        {
          emails: {
            $elemMatch: {
              value: {$regex: '^john', $options: 'i'},
            },
          },
        },
      ],
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('AND') || result.query.includes('and'));
});

test('Regex pattern optimization - starts with', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$regex: '^John', $options: 'i'},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('LIKE'));
  t.true(result.values.p1 === 'John%');
});

test('Regex pattern optimization - ends with', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {
        $elemMatch: {
          value: {$regex: '@company\\.com$', $options: 'i'},
        },
      },
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('EXISTS'));
});

test('Regex pattern optimization - exact match', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      uid: {$regex: '^contact-123$', $options: 'i'},
    },
  });

  t.true(result.query.includes('uid'));
  t.true(result.query.includes('=') || result.query.includes('LIKE'));
});

