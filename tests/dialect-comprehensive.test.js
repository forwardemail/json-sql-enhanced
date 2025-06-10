const test = require('ava');

// Test all dialects with comprehensive examples from README
const dialects = ['base', 'postgresql', 'mysql', 'sqlite', 'mssql'];

for (const dialectName of dialects) {
  const jsonSql = require('../lib/index.js')({dialect: dialectName});

  test(`${dialectName}: Basic $regex with $options case insensitive`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        fullName: {$regex: 'John', $options: 'i'},
      },
    });

    t.true(result.query.includes('fullName'));
    t.true(
      result.query.includes('LIKE')
        || result.query.includes('ILIKE')
        || result.query.includes('~*')
        || result.query.includes('REGEXP'),
    );
  });

  test(`${dialectName}: $elemMatch with nested $regex and $options`, t => {
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
    t.true(
      result.query.includes('JSON')
        || result.query.includes('LIKE')
        || result.query.includes('EXISTS')
        || result.query.includes('jsonb_path_query')
        || result.query.includes('~'),
    );
  });

  test(`${dialectName}: $elemMatch with phone numbers`, t => {
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
      result.query.includes('555-1234')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && v.includes('555-1234'),
          )),
    );
  });

  test(`${dialectName}: $regex with exact match pattern`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        uid: {$regex: '^contact-123$', $options: 'i'},
      },
    });

    t.true(result.query.includes('uid'));
    t.true(
      result.query.includes('LIKE')
        || result.query.includes('=')
        || result.query.includes('REGEXP')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && v.includes('contact-123'),
          )),
    );
  });

  test(`${dialectName}: $regex with starts with pattern`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        fullName: {$regex: '^John', $options: 'i'},
      },
    });

    t.true(result.query.includes('fullName'));
    t.true(
      result.query.includes('LIKE')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && v.includes('John%'),
          )),
    );
  });

  test(`${dialectName}: $elemMatch with ends with pattern`, t => {
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
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && (v.includes('company.com') || v.includes('company')),
          )),
    );
  });

  test(`${dialectName}: $elemMatch with type matching`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        emails: {$elemMatch: {type: {$regex: '^WORK$', $options: 'i'}}},
      },
    });

    t.true(result.query.includes('emails'));
    t.true(
      result.query.includes('WORK')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && v.includes('WORK'),
          )),
    );
  });

  test(`${dialectName}: $or with $exists and $size`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        $or: [{emails: {$exists: false}}, {emails: {$size: 0}}],
      },
    });

    t.true(result.query.includes('emails'));
    t.true(
      result.query.includes('IS NULL')
        || result.query.includes('LENGTH')
        || result.query.includes('JSON_LENGTH')
        || result.query.includes('json_array_length'),
    );
  });

  test(`${dialectName}: $exists with $nin`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        fullName: {$exists: true, $nin: [null, '']},
      },
    });

    t.true(result.query.includes('fullName'));
    t.true(result.query.includes('IS NOT NULL'));
    t.true(result.query.includes('not in') || result.query.includes('NOT IN'));
  });

  test(`${dialectName}: $not with nested $regex`, t => {
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

  test(`${dialectName}: $not with $elemMatch`, t => {
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

  test(`${dialectName}: Complex $and with multiple $elemMatch`, t => {
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
              $elemMatch: {value: {$regex: '^john', $options: 'i'}},
            },
          },
        ],
      },
    });

    t.true(result.query.includes('emails'));
    t.true(
      result.query.includes('example.com')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && (v.includes('example.com') || v.includes('@example')),
          )),
    );
  });

  test(`${dialectName}: $regex with empty $options`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        fullName: {$regex: 'John', $options: ''},
      },
    });

    t.true(result.query.includes('fullName'));
    t.true(
      result.query.includes('LIKE')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && v.includes('John'),
          )),
    );
  });

  test(`${dialectName}: $elemMatch with special characters in regex`, t => {
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
      result.query.includes('user+tag')
        || (result.values
          && Object.values(result.values).some(
            v => typeof v === 'string' && (v.includes('user+tag') || v.includes('user\\+tag') || v.includes('user')),
          )),
    );
  });

  test(`${dialectName}: Complex nested $or and $and with $size and $not`, t => {
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
      result.query.includes('LENGTH')
        || result.query.includes('JSON_LENGTH')
        || result.query.includes('json_array_length')
        || result.query.includes('jsonb_array_length')
        || result.query.includes('COUNT')
        || result.query.includes('OPENJSON'),
    );
  });

  test(`${dialectName}: $elemMatch with $exists and $ne`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'contacts',
      condition: {
        phoneNumbers: {$elemMatch: {type: {$exists: true, $ne: null}}},
      },
    });

    t.true(result.query.includes('phoneNumbers'));
    t.true(
      result.query.includes('IS NOT NULL')
        || result.query.includes('!= null')
        || result.query.includes('<> null'),
    );
  });

  test(`${dialectName}: Backward compatibility with original operators`, t => {
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
    t.true(result.query.includes('in') || result.query.includes('IN'));
    t.true(result.query.includes('!=') || result.query.includes('<>'));
  });

  test(`${dialectName}: $size operator for arrays`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'users',
      condition: {
        tags: {$size: 3},
        emails: {$size: {$gt: 0}},
      },
    });

    t.true(result.query.includes('tags'));
    t.true(result.query.includes('emails'));
    t.true(
      result.query.includes('LENGTH')
        || result.query.includes('JSON_LENGTH')
        || result.query.includes('json_array_length')
        || result.query.includes('jsonb_array_length')
        || result.query.includes('COUNT(*) FROM OPENJSON'),
    );
  });

  test(`${dialectName}: $exists operator for field presence`, t => {
    const result = jsonSql.build({
      type: 'select',
      table: 'users',
      condition: {
        email: {$exists: true},
        phone: {$exists: false},
      },
    });

    t.true(result.query.includes('email'));
    t.true(result.query.includes('phone'));
    t.true(result.query.includes('IS NOT NULL'));
    t.true(result.query.includes('IS NULL'));
  });
}
