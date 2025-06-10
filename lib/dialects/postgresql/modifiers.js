'use strict';

module.exports = function (dialect) {
  dialect.modifiers.add('$jsonConcatenate', (field, value) =>
    [field, '=', field, '||', value].join(' '),
  );

  dialect.modifiers.add('$jsonDelete', (field, value) =>
    [field, '=', field, '-', value].join(' '),
  );

  dialect.modifiers.add('$jsonDeleteByPath', (field, value) =>
    [field, '=', field, '#-', value].join(' '),
  );
};
