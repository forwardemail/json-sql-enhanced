'use strict';

module.exports = function (dialect) {
  dialect.modifiers.add('$set', (field, value) =>
    [field, '=', value].join(' '),
  );

  dialect.modifiers.add('$inc', (field, value) =>
    [field, '=', field, '+', value].join(' '),
  );

  dialect.modifiers.add('$dec', (field, value) =>
    [field, '=', field, '-', value].join(' '),
  );

  dialect.modifiers.add('$mul', (field, value) =>
    [field, '=', field, '*', value].join(' '),
  );

  dialect.modifiers.add('$div', (field, value) =>
    [field, '=', field, '/', value].join(' '),
  );

  dialect.modifiers.add('$default', field =>
    [field, '=', 'default'].join(' '),
  );
};
