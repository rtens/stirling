const Violation = require('./Violation')
const Fact = require('./Fact')
const Record = require('./Record')

module.exports = class Service {
    constructor(journal, log) {
        this.journal = journal
        this.log = log

        this.entities = []
    }

    register(entity) {
        this.entities.push(entity)
        return this
    }

    execute(command) {
        const trace = command.trace
        this.log.info(trace, 'Executing', command.attributes())

        return handle.call(this, trace, () => Promise.resolve()
            .then(() => findEntity.call(this, command, 'canExecute', 'command'))
            .then(entity => {
                const aggregateId = entity.identify(command)
                if (!aggregateId) throw new Error('Could not identify aggregate. Got: ' + aggregateId)
                const instance = new entity(aggregateId)
                let revision = 0

                return Promise.resolve()
                    .then(() => this.journal.iterate(record => {
                        instance.apply && instance.apply(record)
                        if (record.aggregateId == aggregateId) revision = record.revision + 1
                    }))
                    .then(() => instance.execute(command))
                    .then(facts => validateFacts(facts)
                        && new Record(trace, aggregateId, revision, facts))
                    .then(record => this.journal.record(record)
                        .then(() => this.log.info(trace, 'Executed'))
                        .then(() => this.reactTo(record)))
            }))
    }

    answer(query) {
        const trace = query.trace
        this.log.info(trace, 'Answering', query.attributes())

        return handle.call(this, trace, () => Promise.resolve()
            .then(() => findEntity.call(this, query, 'canAnswer', 'query'))
            .then(entity => new entity())
            .then(instance => Promise.resolve()
                .then(() => this.journal.iterate(record => instance.apply(record)))
                .then(() => instance.answer(query)))
            .then(answer => this.log.info(trace, 'Answered') || answer))
    }

    reactTo(record) {
        if (record.facts.some(e => e.name == 'PURGED')) {
            this.log.info(record.trace, 'Purging', { aggregateId: record.aggregateId })
            this.journal.purge(record.aggregateId)
        }

        this.entities
            .filter(entity => entity.prototype.reactTo)
            .map(entity => new entity())
            .forEach(instance => Promise.resolve()
                .then(() => this.journal.iterate(record => instance.apply(record)))
                .then(() => instance.reactTo(record))
                .catch(e => this.log.error(record.trace, e)))
    }
}

function findEntity(action, tester, type) {
    const entity = this.entities.find(e => e[tester] && e[tester](action))
    if (!entity) return Promise.reject(new Violation.UnknownAction({ action: type, ...action.attributes() }))
    return entity
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