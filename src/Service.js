const Violation = require('./Violation')
const Fact = require('./Fact')
const Record = require('./Record')

module.exports = class Service {
    constructor(registry, journal, log) {
        this.registry = registry
        this.journal = journal
        this.log = log
    }

    execute(command) {
        this.log.info(command.trace, 'Executing', command.attributes())

        return handle.call(this, command.trace, () => Promise.resolve()
            .then(() => this.registry.findAggregateExecuting(command))
            .then(aggregateClass => {
                const aggregateId = aggregateClass.identify(command)
                if (!aggregateId) throw new Error('Could not identify aggregate. Got: ' + aggregateId)
                
                const aggregate = new aggregateClass()
                let revision = 0

                return Promise.resolve()
                    .then(() => this.journal.iterate(record => {
                        if (record.aggregateId != aggregateId) return

                        aggregate.apply(record)
                        revision = record.revision + 1
                    }))
                    .then(() => aggregate.execute(command))
                    .then(facts => validateFacts(facts)
                        && new Record(command.trace, aggregateId, revision, facts))
                    .then(record => this.journal.record(record)
                        .then(() => this.log.info(command.trace, 'Executed'))
                        .then(() => this.reactTo(record)))
            }))
    }

    answer(query) {
        this.log.info( query.trace, 'Answering', query.attributes())

        return handle.call(this,  query.trace, () => Promise.resolve()
            .then(() => this.registry.findProjectionAnswering(query))
            .then(projectionClass => new projectionClass())
            .then(projection => Promise.resolve()
                .then(() => this.journal.iterate(record =>
                    projection.project(record)))
                .then(() => projection.answer(query)))
            .then(answer => this.log.info( query.trace, 'Answered') || answer))
    }

    reactTo(record) {
        if (record.facts.some(e => e.name == 'PURGED')) {
            this.log.info(record.trace, 'Purging', { aggregateId: record.aggregateId })
            this.journal.purge(record.aggregateId)
        }

        this.registry.allReactions()
            .map(reactionClass => new reactionClass())
            .forEach(reaction => Promise.resolve()
                .then(() => reaction.reactTo(record))
                .catch(e => this.log.error(record.trace, e)))
    }
}

function handle(trace, using) {
    return Promise.resolve()
        .then(using)
        .catch(e => (e instanceof Violation.Generic
            ? this.log.info(trace, 'Violation: ' + e.message, e.details)
            : this.log.error(trace, e))
            || Promise.reject(e))
}

function validateFacts(facts) {
    if (facts && facts.length && facts.every(f => f instanceof Fact)) return facts
    throw new Error('Execution did not return a list of facts')
}