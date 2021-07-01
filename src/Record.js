module.exports = class Record {
    constructor(trace, aggregateId, revision, facts) {
        this.trace = trace
        this.aggregateId = aggregateId
        this.revision = revision
        this.facts = facts
    }

    flatten() {
        return {
            ...this,
            facts: this.facts.map(f => ({ ...f }))
        }
    }
}