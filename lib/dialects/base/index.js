const ValuesStore = require('../../utils/values-store.js');
const objectUtils = require('../../utils/object.js');
const templatesInit = require('./templates.js');
const blocksInit = require('./blocks.js');
const operatorsInit = require('./operators/index.js');
const modifiersInit = require('./modifiers.js');

const blockRegExp = /{([a-z\d:]+)}/gi;

function Dialect(builder) {
  this.builder = builder;

  this.templates = new ValuesStore();
  this.blocks = new ValuesStore();
  this.operators = {
    comparison: new ValuesStore(),
    logical: new ValuesStore(),
    fetching: new ValuesStore(),
    state: new ValuesStore(),
  };
  this.modifiers = new ValuesStore();

  // Init templates
  templatesInit(this);

  // Init blocks
  blocksInit(this);

  // Init operators
  operatorsInit(this);

  // Init modifiers
  modifiersInit(this);
}

Dialect.prototype.buildQuery = function (query) {
  // Backwards compatibility: infer query type if not specified
  if (!query.type) {
    // Infer type based on properties
    if (query.values && !query.condition) {
      query = { ...query, type: 'insert' };
    } else if (query.values && query.condition) {
      query = { ...query, type: 'update' };
    } else if (query.condition && !query.fields && !query.table) {
      query = { ...query, type: 'remove' };
    } else {
      query = { ...query, type: 'select' };
    }
  }

  const template = this.templates.get(query.type);

  if (!template) {
    throw new Error('Unknown query type "' + query.type + '"');
  }

  // Backwards compatibility: map 'values' to 'modifier' for update queries
  if (query.type === 'update' && query.values && !query.modifier) {
    query = { ...query, modifier: query.values };
  }

  return this.buildTemplate(template.pattern, query);
};

Dialect.prototype.buildTemplate = function (templateName, query) {
  // If templateName is already a pattern string, use it directly
  if (typeof templateName === 'string' && templateName.includes('{')) {
    const template = templateName;
    const result = template.replaceAll(blockRegExp, (match, blockName) => {
      const block = this.blocks.get(blockName);

      if (!block) {
        // Return empty string for unknown blocks instead of throwing error
        return '';
      }

      const blockResult = block.call(this, query);
      return blockResult || '';
    });

    // Clean up extra spaces
    return result.replaceAll(/\s+/g, ' ').trim();
  }

  // Otherwise, get the template by name
  const template = this.templates.get(templateName);
  if (!template) {
    throw new Error('Unknown template "' + templateName + '"');
  }

  const result = template.pattern.replaceAll(
    blockRegExp,
    (match, blockName) => {
      const block = this.blocks.get(blockName);

      if (!block) {
        // Return empty string for unknown blocks instead of throwing error
        return '';
      }

      const blockResult = block.call(this, query);
      return blockResult || '';
    }
  );

  // Clean up extra spaces
  return result.replaceAll(/\s+/g, ' ').trim();
};

Dialect.prototype.buildCondition = function (conditions) {
  if (!conditions) {
    return '';
  }

  if (Array.isArray(conditions)) {
    const conditionsArray = [];

    for (const condition of conditions) {
      const conditionQuery = this.buildCondition(condition);
      if (conditionQuery) {
        conditionsArray.push(conditionQuery);
      }
    }

    return conditionsArray.join(' and ');
  }

  if (typeof conditions === 'object') {
    const conditionsArray = [];

    for (const [field, value] of Object.entries(conditions)) {
      const conditionQuery = this.buildLogicalCondition(field, value);
      if (conditionQuery) {
        conditionsArray.push(conditionQuery);
      }
    }

    return conditionsArray.join(' and ');
  }

  return '';
};

Dialect.prototype.buildLogicalCondition = function (operator, operand) {
  const logicalOperator = this.operators.logical.get(operator);

  if (logicalOperator) {
    if (typeof logicalOperator === 'function') {
      return logicalOperator.call(this, operand);
    }

    if (logicalOperator.fn) {
      // For logical operators, we need to process the operand first
      if (Array.isArray(operand)) {
        const processedConditions = [];
        for (const condition of operand) {
          const conditionQuery = this.buildCondition(condition);
          if (conditionQuery) {
            processedConditions.push(conditionQuery);
          }
        }

        return logicalOperator.fn.call(this, processedConditions);
      }

      if (typeof operand === 'object' && operand !== null) {
        // For $not with object operand
        const conditionQuery = this.buildCondition(operand);
        if (conditionQuery) {
          return logicalOperator.fn.call(this, [conditionQuery]);
        }
      }

      return logicalOperator.fn.call(this, operand);
    }
  }

  return this.buildComparisonCondition(operator, operand);
};

Dialect.prototype.buildComparisonCondition = function (field, value) {
  if (objectUtils.isSimpleValue(value)) {
    return this.buildComparisonOperator('$eq', field, value);
  }

  if (typeof value === 'object' && value !== null) {
    const conditionsArray = [];

    for (const [operator, operand] of Object.entries(value)) {
      const conditionQuery = this.buildComparisonOperator(
        operator,
        field,
        operand
      );
      if (conditionQuery) {
        conditionsArray.push(conditionQuery);
      }
    }

    return conditionsArray.join(' and ');
  }

  return '';
};

Dialect.prototype.buildComparisonOperator = function (operator, field, value) {
  const comparisonOperator = this.operators.comparison.get(operator);

  if (!comparisonOperator) {
    throw new Error('Unknown comparison operator "' + operator + '"');
  }

  if (typeof comparisonOperator === 'function') {
    return comparisonOperator.call(this, field, value);
  }

  if (comparisonOperator.fn) {
    return comparisonOperator.fn.call(this, field, value);
  }

  throw new Error(
    'Invalid comparison operator structure for "' + operator + '"'
  );
};

Dialect.prototype.buildModifier = function (modifier, value) {
  const modifierFunction = this.modifiers.get(modifier);

  if (!modifierFunction) {
    throw new Error('Unknown modifier "' + modifier + '"');
  }

  return modifierFunction.call(this, value);
};

Dialect.prototype.buildBlock = function (blockName, query) {
  const block = this.blocks.get(blockName);

  if (!block) {
    throw new Error('Unknown block "' + blockName + '"');
  }

  return block.call(this, query);
};

Dialect.prototype.wrapIdentifier = function (name) {
  if (!this.builder.options.wrappedIdentifiers) {
    return name;
  }

  // Don't wrap special SQL keywords and wildcards
  if (name === '*') {
    return name;
  }

  // Don't wrap SQL functions (anything with parentheses)
  if (name.includes('(') && name.includes(')')) {
    return name;
  }

  // Don't wrap SQL expressions (CASE, SELECT, etc.)
  const upperName = name.toUpperCase().trim();
  if (
    upperName.startsWith('CASE ') ||
    upperName.startsWith('SELECT ') ||
    upperName.startsWith('(SELECT ') ||
    upperName.includes(' WHEN ') ||
    upperName.includes(' THEN ') ||
    upperName.includes(' ELSE ') ||
    upperName.includes(' END')
  ) {
    return name;
  }

  return '"' + name + '"';
};

Dialect.prototype.buildTerm = function (term) {
  if (typeof term === 'string') {
    return this.wrapIdentifier(term);
  }

  if (objectUtils.isSimpleValue(term)) {
    return this.builder._pushValue(term);
  }

  if (Array.isArray(term)) {
    return this.builder._pushValue(term);
  }

  if (typeof term === 'object' && term !== null) {
    if (term.query) {
      return '(' + this.buildQuery(term.query) + ')';
    }

    if (term.select) {
      return '(' + this.buildQuery({ type: 'select', ...term.select }) + ')';
    }

    if (term.field) {
      return this.buildField(term.field, term.table);
    }

    if (term.value !== undefined) {
      return this.builder._pushValue(term.value);
    }

    if (term.func) {
      return this.buildFunction(term.func);
    }

    if (term.expression) {
      return this.buildExpression(term.expression);
    }

    if (
      objectUtils.hasSome(term, Object.keys(this.operators.comparison.getAll()))
    ) {
      throw new Error('Operators are not allowed in this context');
    }

    // Handle object as field name
    const keys = Object.keys(term);
    if (keys.length === 1) {
      return this.wrapIdentifier(keys[0]);
    }
  }

  throw new Error('Invalid term');
};

Dialect.prototype.buildField = function (field, table) {
  if (typeof field === 'string') {
    if (table) {
      return this.wrapIdentifier(table) + '.' + this.wrapIdentifier(field);
    }

    return this.wrapIdentifier(field);
  }

  if (typeof field === 'object' && field !== null) {
    const fieldName = this.wrapIdentifier(field.name);
    const tableName = field.table ? this.wrapIdentifier(field.table) : table;

    if (tableName) {
      return tableName + '.' + fieldName;
    }

    return fieldName;
  }

  throw new Error('Invalid field');
};

Dialect.prototype.buildFunction = function (func) {
  if (typeof func === 'string') {
    return func + '()';
  }

  if (typeof func === 'object' && func !== null) {
    const { name } = func;
    const args = func.args || [];

    const argsString = args
      .map((argument) => this.buildTerm(argument))
      .join(', ');

    return name + '(' + argsString + ')';
  }

  throw new Error('Invalid function');
};

Dialect.prototype.buildExpression = function (expression) {
  if (typeof expression === 'string') {
    return expression;
  }

  if (typeof expression === 'object' && expression !== null) {
    const { pattern } = expression;
    const values = expression.values || {};

    return pattern.replaceAll(/{([^}]+)}/g, (match, key) => {
      if (values[key] !== undefined) {
        return this.builder._pushValue(values[key]);
      }

      return match;
    });
  }

  throw new Error('Invalid expression');
};

module.exports = Dialect;
