const Builder = require('./builder.js');

module.exports = function (options) {
  return new Builder(options);
};

module.exports.Builder = Builder;
