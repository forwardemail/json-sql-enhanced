'use strict';

const {inherits} = require('util');
const BaseDialect = require('../base/index.js');
const templatesInit = require('./templates.js');
const blocksInit = require('./blocks.js');
const operatorsInit = require('./operators/index.js');
const modifiersInit = require('./modifiers.js');

const Dialect = function (builder) {
  BaseDialect.call(this, builder);

  // Init templates
  templatesInit(this);

  // Init blocks
  blocksInit(this);

  // Init operators
  operatorsInit(this);

  // Init modifiers
  modifiersInit(this);
};

module.exports = Dialect;

inherits(Dialect, BaseDialect);

Dialect.prototype.config = {
  jsonSeparatorRegexp: /->>?/g,
  ...BaseDialect.prototype.config,
};

Dialect.prototype._wrapIdentifier = function (name) {
  // Split by json separator
  const nameParts = name.split(this.config.jsonSeparatorRegexp);
  const separators = name.match(this.config.jsonSeparatorRegexp);

  // Wrap base identifier
  let identifier = BaseDialect.prototype._wrapIdentifier.call(
    this,
    nameParts[0],
  );

  // Wrap all json identifier and join them with separators
  if (separators) {
    identifier += separators.reduce(
      (memo, separator, index) =>
        memo + separator + '\'' + nameParts[index + 1] + '\'',
      '',
    );
  }

  return identifier;
};
