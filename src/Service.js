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

        return safely.call(this, command.trace, () => Promise.resolve()
            .then(() => this.registry.findAggregateExecuting(command))
            .then(aggregateClass => instantiate(aggregateClass, command))
            .then(instance => reconstitute(instance, this.journal)
                .then(revision => execute(instance, revision, command, this.journal, this.log)))
            .then(record => record ? this.reactTo(record) : null))
    }

    answer(query) {
        this.log.info(query.trace, 'Answering', query.attributes())

        return safely.call(this, query.trace, () => Promise.resolve()
            .then(() => this.registry.findProjectionAnswering(query))
            .then(projectionClass => new projectionClass())
            .then(projection => Promise.resolve()
                .then(() => this.journal.iterate(record => projection.project(record)))
                .then(() => projection.answer(query)))
            .then(answer => this.log.info(query.trace, 'Answered') || answer))
    }

    reactTo(record) {
        if (record.facts.some(e => e.name == 'ERASED')) {
            this.log.info(record.trace, 'Erasing', { aggregateId: record.aggregateId })
            this.journal.erase(record.aggregateId)
        }

        this.registry.allReactions()
            .map(reactionClass => new reactionClass())
            .forEach(reaction => Promise.resolve()
                .then(() => reaction.reactTo(record))
                .catch(e => this.log.error(record.trace, e)))
    }
}

function safely(trace, that) {
    return Promise.resolve(that())
        .catch(e => (e instanceof Violation.Generic
            ? this.log.info(trace, 'Violation: ' + e.message, e.details)
            : this.log.error(trace, e))
            || Promise.reject(e))
}

function instantiate(aggregateClass, command) {
    const aggregateId = aggregateClass.identify(command)
    if (!aggregateId) throw new Error('Could not identify aggregate. Got: ' + aggregateId)
    const aggregate = new aggregateClass()

    return { aggregateId, aggregate }
}

function reconstitute({ aggregateId, aggregate }, journal) {
    let revision = 0

    return journal.iterate(record => {
        if (record.aggregateId != aggregateId) return

        aggregate.apply(record)
        revision = record.revision + 1
    }).then(() => revision)
}

function execute({ aggregateId, aggregate }, revision, command, journal, log) {
    return Promise.resolve(aggregate.execute(command))
        .then(facts => {
            if (!facts) return log.info(command.trace, 'Executed')

            const record = new Record(command.trace, aggregateId, revision, facts)
            return journal.record(record)
                .then(() => log.info(command.trace, 'Executed', record.flatten()))
                .then(() => record)
        })
}