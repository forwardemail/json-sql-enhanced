'use strict';

module.exports = function (dialect) {
  dialect.operators.state.add('$not', {
    getOperator(operator) {
      const operatorParameters = dialect.operators.comparison.get(operator);

      if (!operatorParameters || !operatorParameters.inversedOperator) {
        throw new Error(
          'Cannot get inversed operator for operator `' + operator + '`',
        );
      }

      return operatorParameters.inversedOperator;
    },
  });
};
