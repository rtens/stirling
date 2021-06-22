var NeDB = require('nedb')

module.exports = class NeDbJournal {
    constructor(path = null) {
        this.followers = []

        if (!path) {
            this.db = new NeDB()
        } else {
            this.db = new NeDB({
                filename: path + '/journal.db',
                autoload: true,
            })
        }

        this.db.ensureIndex({ fieldName: 'aggregateId' },
            err => err ? console.error('Failed to create index') : null);
    }

    record(record) {
        return new Promise((y, n) =>
            this.db.insert(
                {
                    _id: record.aggregateId + '::' + record.revision,
                    ...record
                },
                err => err ? n(err) : y()))
            .then(() => this.followers.forEach(f => f(record)))
    }

    follow(follower) {
        this.followers.push(follower)
    }

    iterate(iterator) {
        return find.call(this, {}, iterator)
    }

    purge(aggregateId) {
        return new Promise((y, n) =>
            this.db.remove(
                { aggregateId },
                { multi: true },
                err => err ? n(err) : y()))
    }
}

function find(query, iterator) {
    return new Promise((y, n) =>
        this.db.find(query)
            .sort({ revision: 1 })
            .exec((err, records) =>
                err ? n(err)
                    : y(records
                        .map(record => delete record._id && record)
                        .forEach(iterator))))
}
