// Helper functions to replace underscore
function isUndefined(value) {
  return value === undefined;
}

module.exports = function (dialect) {
  dialect.blocks.add('offset', (parameters) => {
    let limit = '';

    if (isUndefined(parameters.limit)) {
      limit = dialect.buildBlock('limit', { limit: -1 }) + ' ';
    }

    return limit + 'offset ' + dialect.builder._pushValue(parameters.offset);
  });
};
