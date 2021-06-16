const test = require('ava');
const NeDbJournal = require('../src/NeDbJournal')

const journals = {
    NeDB: () => new NeDbJournal()
}

Object.keys(journals).forEach(name => {
    const makeJournal = journals[name]

    test('Nothing to find with ' + name, t => {
        // CONTEXT
        const journal = makeJournal()

        // ACTION
        const records = []
        return journal.iterate(r => records.push(r))

            //EXPECTATIONS
            .then(() => t.deepEqual(records, []))
    })

    test('Record and iterate over records with ' + name, t => {
        // CONTEXT
        const journal = makeJournal()
        journal.record({
            aggregateId: 'foo',
            revision: 42,
            events: ['one', 'two']
        })
        journal.record({
            aggregateId: 'bar',
            revision: 43,
            events: ['four']
        })
        journal.record({
            aggregateId: 'bar',
            revision: 42,
            events: ['three']
        })

        // ACTION
        const records = []
        return journal.iterate(r => records.push(r))

            //EXPECTATIONS
            .then(() => t.deepEqual(records, [{
                aggregateId: 'bar',
                revision: 42,
                events: ['three'],
            }, {
                aggregateId: 'bar',
                revision: 43,
                events: ['four'],
            }, {
                aggregateId: 'foo',
                revision: 42,
                events: ['one', 'two'],
            }]))
    })

    test('Follow records with ' + name, t => {
        // CONTEXT
        const journal = makeJournal()
        let followed = []
        journal.follow(record => followed.push(record))
        journal.follow(() => followed.push('two'))

        // ACTION
        return journal.record({
            aggregateId: 'foo',
            revision: 42
        })

            //EXPECTATIONS
            .then(() => t.deepEqual(followed, [
                {
                    aggregateId: 'foo',
                    revision: 42
                },
                'two'
            ]))
    })

    test('Iterate over records of single aggregate with ' + name, t => {
        // CONTEXT
        const journal = makeJournal()
        journal.record({
            aggregateId: 'foo',
            revision: 42,
            events: ['one']
        })
        journal.record({
            aggregateId: 'bar',
            revision: 42
        })
        journal.record({
            aggregateId: 'foo',
            revision: 43,
            events: ['two']
        })

        // ACTION
        const records = []
        return journal.iterateAggregate('foo', r => records.push(r))

            //EXPECTATIONS
            .then(() => t.deepEqual(records, [{
                aggregateId: 'foo',
                revision: 42,
                events: ['one']
            }, {
                aggregateId: 'foo',
                revision: 43,
                events: ['two']
            }]))
    })

    test('Avoid revision conflicts with ' + name, t => {
        // CONTEXT
        const journal = makeJournal()
        return Promise.resolve()
            .then(() => journal.record({
                aggregateId: 'foo',
                revision: 42
            }))

            // ACTION
            .then(() => journal.record({
                aggregateId: 'foo',
                revision: 42
            }))

            //EXPECTATIONS
            .then(() => t.fail('Should have thrown'))
            .catch(err => t.not(err, null))
    })

    test('Purge records of an aggregate with ' + name, t => {
        // CONTEXT
        const journal = makeJournal()
        return Promise
            .all([
                journal.record({
                    aggregateId: 'foo',
                    revision: 42
                }),
                journal.record({
                    aggregateId: 'bar',
                    revision: 42
                }),
                journal.record({
                    aggregateId: 'foo',
                    revision: 43
                })])

            // ACTION
            .then(() =>
                journal.purge('foo'))

            //EXPECTATIONS
            .then(() => {
                const records = []
                return journal.iterate(r => records.push(r))
                    .then(() => t.deepEqual(records, [{
                        aggregateId: 'bar',
                        revision: 42
                    }]))
            })
    })
})