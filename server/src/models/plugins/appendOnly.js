'use strict';

const BLOCKED_QUERY_OPS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];

/**
 * Make a collection append-only: every query/document operation that would change or remove
 * existing entries throws, as does re-saving a loaded document.
 * @param {import('mongoose').Schema} schema
 * @param {{ name: string }} options model name used in the error message
 */
function appendOnly(schema, { name }) {
  const reject = () => {
    throw new Error(`${name} is append-only`);
  };
  for (const op of BLOCKED_QUERY_OPS) schema.pre(op, { document: false, query: true }, reject);
  schema.pre(['updateOne', 'deleteOne'], { document: true, query: false }, reject);
  schema.pre('save', function rejectResave() {
    if (!this.isNew) reject();
  });
  schema.pre('bulkWrite', reject);
}

module.exports = { appendOnly };
