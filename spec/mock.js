const Service = require('../src/Service')
const Registry = require('../src/Registry')

class Journal {
    constructor() {
        this.records = []
        this.recorded = []
        this.followers = []
    }

    record(record) {
        this.recorded.push({...record, facts: record.facts.map(e => ({ ...e }))})
        return Promise.all(this.followers.map(f => f(record)))
    }

    erase(aggregateId) {
        this.recorded.push({ erased: aggregateId })
        return Promise.resolve()
    }

    iterate(iterator) {
        return Promise.resolve(this.records
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
    const registry = new Registry()
    const journal = new Journal()
    const log = new Log()
    const service = new Service(registry, journal, log)

    return { service, registry, journal, log }
}

module.exports = {
    context
}