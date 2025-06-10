const test = require('ava');
const jsonSql = require('../lib/index.js')();

// Test all the specific query examples provided by the user
test('$regex with $options case insensitive', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$regex: 'John', $options: 'i'},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('LIKE') || result.query.includes('ILIKE'));
});

test('$elemMatch with nested $regex and $options', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {
        $elemMatch: {value: {$regex: 'john@example\\.com', $options: 'i'}},
      },
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('JSON') || result.query.includes('LIKE') || result.query.includes('json'));
});

test('$elemMatch with phone numbers', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      phoneNumbers: {
        $elemMatch: {value: {$regex: '555-1234', $options: 'i'}},
      },
    },
  });

  t.true(result.query.includes('phoneNumbers'));
  t.true(
    result.query.includes('555-1234') || result.values.p1.includes('555-1234'),
  );
});

test('$regex with exact match pattern', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      uid: {$regex: '^contact-123$', $options: 'i'},
    },
  });

  t.true(result.query.includes('uid'));
  t.true(result.query.includes('LIKE') || result.query.includes('contact-123') || (result.values && Object.values(result.values).some(v => typeof v === 'string' && v.includes('contact-123'))));
});

test('$regex with starts with pattern', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$regex: '^John', $options: 'i'},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('LIKE') || result.values.p1.includes('John%'));
});

test('$elemMatch with ends with pattern', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {
        $elemMatch: {value: {$regex: '@company\\.com$', $options: 'i'}},
      },
    },
  });

  t.true(result.query.includes('emails'));
  t.true(
    result.query.includes('company.com')
      || (result.values.p1 && (result.values.p1.includes('%company.com') || result.values.p1.includes('company'))),
  );
});

test('$elemMatch with type matching', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {$elemMatch: {type: {$regex: '^WORK$', $options: 'i'}}},
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('WORK') || result.values.p1.includes('WORK'));
});

test('$or with $exists and $size', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $or: [{emails: {$exists: false}}, {emails: {$size: 0}}],
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('IS NULL') || result.query.includes('LENGTH'));
});

test('$exists with $nin', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$exists: true, $nin: [null, '']},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(
    result.query.includes('IS NOT NULL') && result.query.includes('not in'),
  );
});

test('$not with nested $regex', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $not: {fullName: {$regex: 'John', $options: 'i'}},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('NOT') || result.query.includes('!=') || result.query.includes('not'));
});

test('$not with $elemMatch', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $not: {
        emails: {
          $elemMatch: {type: {$regex: '^WORK$', $options: 'i'}},
        },
      },
    },
  });

  t.true(result.query.includes('emails'));
  t.true(result.query.includes('NOT') || result.query.includes('not'));
});

test('Complex $and with multiple $elemMatch', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $and: [
        {
          emails: {
            $elemMatch: {value: {$regex: '@example\\.com', $options: 'i'}},
          },
        },
        {
          emails: {$elemMatch: {value: {$regex: '^john', $options: 'i'}}},
        },
      ],
    },
  });

  t.true(result.query.includes('emails'));
  t.true(
    result.query.includes('example.com')
      || (result.values.p1 && (result.values.p1.includes('example.com') || result.values.p1.includes('@example'))),
  );
});

test('$regex with empty $options', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      fullName: {$regex: 'John', $options: ''},
    },
  });

  t.true(result.query.includes('fullName'));
  t.true(result.query.includes('LIKE') || result.values.p1.includes('John'));
});

test('$elemMatch with special characters in regex', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      emails: {
        $elemMatch: {
          value: {$regex: 'user\\+tag@example\\.com', $options: 'i'},
        },
      },
    },
  });

  t.true(result.query.includes('emails'));
  t.true(
    result.query.includes('user+tag') || (result.values.p1 && (result.values.p1.includes('user+tag') || result.values.p1.includes('user\\+tag') || result.values.p1.includes('user'))),
  );
});

test('Complex nested $or and $and with $size and $not', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      $or: [
        {emails: {$size: 0}},
        {
          emails: {
            $not: {$elemMatch: {type: {$exists: true, $ne: null}}},
          },
        },
      ],
      $and: [
        {emails2: {$size: 1}},
        {
          emails: {
            $not: {$elemMatch: {type: {$exists: true, $ne: null}}},
          },
        },
      ],
    },
  });

  t.true(result.query.includes('emails'));
  t.true(
    result.query.includes('LENGTH') || result.query.includes('JSON_LENGTH'),
  );
});

test('$elemMatch with $exists and $ne', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'contacts',
    condition: {
      phoneNumbers: {$elemMatch: {type: {$exists: true, $ne: null}}},
    },
  });

  t.true(result.query.includes('phoneNumbers'));
  t.true(result.query.includes('IS NOT NULL') || result.query.includes('!='));
});

// Test backward compatibility
test('Backward compatibility with original operators', t => {
  const result = jsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      age: {$gt: 18, $lt: 65},
      status: {$in: ['active', 'pending']},
      name: {$ne: null},
    },
  });

  t.true(result.query.includes('age'));
  t.true(result.query.includes('>'));
  t.true(result.query.includes('<'));
  t.true(result.query.includes('in'));
  t.true(result.query.includes('!='));
});

// Test multi-dialect support
test('PostgreSQL dialect with $regex', t => {
  const pgJsonSql = require('../lib/index.js')({dialect: 'postgresql'});
  const result = pgJsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      name: {$regex: 'John', $options: 'i'},
    },
  });

  t.true(result.query.includes('name'));
  t.true(result.query.includes('ILIKE') || result.query.includes('~*') || result.query.includes('LIKE'));
});

test('MySQL dialect with $regex', t => {
  const mysqlJsonSql = require('../lib/index.js')({dialect: 'mysql'});
  const result = mysqlJsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      name: {$regex: 'John', $options: 'i'},
    },
  });

  t.true(result.query.includes('name'));
  t.true(result.query.includes('REGEXP') || result.query.includes('LIKE'));
});

test('SQLite dialect with $regex', t => {
  const sqliteJsonSql = require('../lib/index.js')({dialect: 'sqlite'});
  const result = sqliteJsonSql.build({
    type: 'select',
    table: 'users',
    condition: {
      name: {$regex: 'John', $options: 'i'},
    },
  });

  t.true(result.query.includes('name'));
  t.true(result.query.includes('LIKE') || result.query.includes('GLOB'));
});
