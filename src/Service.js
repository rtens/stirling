const Violation = require('./Violation')

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

        const handler = this.handlers.find(handler => handler.canExecute && handler.canExecute(command))
        if (!handler) return Promise.reject(new Violation.UnknownCommand(command.attributes()))

        const aggregateId = handler.identify(command)
        const instance = new handler()

        let revision = 0
        return this.journal.iterateAggregate(aggregateId, record => {
            record.events.forEach(e => instance.apply(e))
            revision = record.revision + 1
        })
            .then(() => instance.execute(command))
            .then(events => (events && events.length)
                ? { trace, aggregateId, revision, events }
                : Promise.reject(new Error('Execution did not return any events')))
            .then(record => this.journal.record(record)
                .then(() => this.reactTo(record)))
            .then(() => this.log.info(trace, 'Executed'))
            .catch(e => this.log.error(trace, 'Command failed', e)
                || Promise.reject(e))
    }

    answer(query) {
        const trace = query.trace
        this.log.info(trace, 'Answering', query.attributes())

        const handler = this.handlers.find(handler => handler.canAnswer && handler.canAnswer(query))
        if (!handler) return Promise.reject(new Violation.UnknownQuery(query.attributes()))

        const instance = new handler()

        return this.journal.iterate(record =>
            record.events.forEach(e => instance.apply(e)))
            .then(() => instance.answer(query))
            .then(answer => this.log.info(trace, 'Answered') || answer)
            .catch(e => this.log.error(trace, 'Query failed', e)
                || Promise.reject(e))
    }

    reactTo(record) {
        if (record.events.some(e => e.name == 'PURGED')) {
            this.log.info(record.trace, 'Purging', { record })
            this.journal.purge(record.aggregateId)
        }

        let count = 0
        this.handlers.filter(handler => handler.prototype.reactTo)
            .map(handler => new handler())
            .forEach(instance => {
                const trace = record.trace + '_R' + count++
                record.events.forEach(event => Promise.resolve()
                    .then(() => instance.reactTo(event, trace))
                    .catch(e => this.log.error(trace, 'Reaction failed', e)))
            })
    }
}