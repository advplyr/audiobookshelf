const { expect } = require('chai')

const {
  booleanLiteral,
  noCaseSortExpression,
  coalesceFunctionName,
  jsonArrayContainsAny,
  jsonArrayContainsValue,
  jsonArrayExpand,
  jsonPathText,
  jsonPathNumber
} = require('../../../server/utils/sqlDialectHelpers')

const sqlite = {
  getDialect: () => 'sqlite'
}

const postgres = {
  getDialect: () => 'postgres'
}

describe('sqlDialectHelpers', () => {
  it('should return sqlite and postgres boolean literals', () => {
    expect(booleanLiteral(true, sqlite)).to.equal('1')
    expect(booleanLiteral(false, sqlite)).to.equal('0')
    expect(booleanLiteral(true, postgres)).to.equal('TRUE')
    expect(booleanLiteral(false, postgres)).to.equal('FALSE')
  })

  it('should generate case-insensitive sort expressions', () => {
    expect(noCaseSortExpression('name', sqlite)).to.equal('name COLLATE NOCASE')
    expect(noCaseSortExpression('name', postgres)).to.equal('LOWER(name)')
  })

  it('should choose the correct null-coalescing function name', () => {
    expect(coalesceFunctionName(sqlite)).to.equal('IFNULL')
    expect(coalesceFunctionName(postgres)).to.equal('COALESCE')
  })

  it('should generate array membership count queries per dialect', () => {
    expect(jsonArrayContainsAny('tags', 'selectedTags', sqlite)).to.equal('(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:selectedTags))')
    expect(jsonArrayContainsAny('tags', 'selectedTags', postgres)).to.equal("(SELECT count(*) FROM jsonb_array_elements_text(COALESCE(tags::jsonb, '[]'::jsonb)) AS json_each(value) WHERE json_each.value IN (:selectedTags))")

    expect(jsonArrayContainsValue('tags', 'tag', sqlite)).to.equal('(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value = :tag)')
    expect(jsonArrayContainsValue('tags', 'tag', postgres)).to.equal("(SELECT count(*) FROM jsonb_array_elements_text(COALESCE(tags::jsonb, '[]'::jsonb)) AS json_each(value) WHERE json_each.value = :tag)")
  })

  it('should generate json array expansion and path extraction by dialect', () => {
    expect(jsonArrayExpand('books.tags', sqlite)).to.equal('json_each(books.tags)')
    expect(jsonArrayExpand('books.tags', postgres)).to.equal("jsonb_array_elements_text(COALESCE(books.tags::jsonb, '[]'::jsonb)) AS json_each(value)")

    expect(jsonPathText('payload', ['metadata', 'filename'], sqlite)).to.equal("json_extract(payload, '$.metadata.filename')")
    expect(jsonPathText('payload', ['metadata', 'filename'], postgres)).to.equal("payload::jsonb #>> '{metadata,filename}'")

    expect(jsonPathNumber('payload', ['duration'], sqlite)).to.equal("json_extract(payload, '$.duration')")
    expect(jsonPathNumber('payload', ['duration'], postgres)).to.equal("NULLIF(payload::jsonb #>> '{duration}', '')::double precision")
  })
})
