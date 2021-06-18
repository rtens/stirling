const Violation = require('./Violation')
const Fact = require('./Fact')

module.exports = class Service {
    constructor(journal, log) {
        this.journal = journal
        this.log = log

        this.handlers = []
    }

    register(handler) {
        this.handlers.push(handler)
        return this
    }

    execute(command) {
        const trace = command.trace
        this.log.info(trace, 'Executing', command.attributes())

        return handle.call(this, trace, () => Promise.resolve()
            .then(() => findHandler.call(this, command, 'canExecute', 'command'))
            .then(handler => {
                const aggregateId = handler.identify(command)
                if (!aggregateId) throw new Error('Could not identify aggregate. Got: ' + aggregateId)
                const instance = new handler()
                let revision = 0

                return Promise.resolve()
                    .then(() => this.journal.iterateAggregate(aggregateId, record => {
                        record.facts.forEach(e => instance.apply(e))
                        revision = record.revision + 1
                    }))
                    .then(() => instance.execute(command))
                    .then(facts => validateFacts(facts))
                    .then(facts => ({ trace, aggregateId, revision, facts }))
                    .then(record => this.journal.record(record)
                        .then(() => this.log.info(trace, 'Executed'))
                        .then(() => this.reactTo(record)))
            }))
    }

    answer(query) {
        const trace = query.trace
        this.log.info(trace, 'Answering', query.attributes())

        return handle.call(this, trace, () => Promise.resolve()
            .then(() => findHandler.call(this, query, 'canAnswer', 'query'))
            .then(handler => new handler())
            .then(instance => Promise.resolve()
                .then(() => this.journal.iterate(record =>
                    record.facts.forEach(e => instance.apply(e))))
                .then(() => instance.answer(query)))
            .then(answer => this.log.info(trace, 'Answered') || answer))
    }

    reactTo(record) {
        if (record.facts.some(e => e.name == 'PURGED')) {
            this.log.info(record.trace, 'Purging', { aggregateId: record.aggregateId })
            this.journal.purge(record.aggregateId)
        }

        let count = 0
        record.facts.forEach(fact => this.handlers
            .filter(handler => handler.canReactTo && handler.canReactTo(fact))
            .forEach(handler => {
                const trace = record.trace + '_' + count++
                this.log.info(trace, 'Reacting', { fact })

                Promise.resolve(new handler())
                    .then(instance => instance.reactTo(fact, trace))
                    .catch(e => this.log.error(trace, e))
            }))
    }
}

function findHandler(action, tester, type) {
    const handler = this.handlers.find(handler => handler[tester] && handler[tester](action))
    if (!handler) return Promise.reject(new Violation.UnknownAction({ action: type, ...action.attributes() }))
    return handler
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