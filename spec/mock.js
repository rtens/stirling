const Service = require('../src/Service')

class Journal {
    constructor() {
        this.records = []
        this.recorded = []
        this.followers = []
    }

    record(record) {
        record.events = record.events.map(e => ({ ...e }))
        this.recorded.push(record)
        return Promise.all(this.followers.map(f => f(record)))
    }

    purge(aggregateId) {
        this.recorded.push({ purged: aggregateId })
        return Promise.resolve()
    }

    iterate(iterator) {
        return Promise.resolve(this.records
            .forEach(iterator))
    }

    iterateAggregate(aggregateId, iterator) {
        return Promise.resolve(this.records
            .filter(r => r.aggregateId == aggregateId)
            .forEach(iterator))
    }

    follow(follower) {
        this.followers.push(follower)
    }
}

class Log {
    constructor() {
        this.errors = []
        this.infos = []
    }

    error(trace, error) {
        this.errors.push({ trace, error })
    }

    info(trace, message, attributes) {
        this.infos.push({ trace, message, attributes })
    }
}

function context() {
    const journal = new Journal()
    const log = new Log()
    const service = new Service(journal, log)

    return { service, journal, log }
}

module.exports = {
    context
}