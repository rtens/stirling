const test = require('ava');
const NeDbJournal = require('../src/NeDbJournal')

const journals = {
    NeDB: () => new NeDbJournal()
}

Object.keys(journals).forEach(name => {
    const makeJournal = journals[name]

    test('Nothing to find with ' + name, t => {
        // CONDITION
        const journal = makeJournal()

        // ACTION
        const records = []
        return journal.iterate(r => records.push(r))

            //EXPECTATION
            .then(() => t.deepEqual(records, []))
    })

    test('Record and iterate over records with ' + name, t => {
        // CONDITION
        const journal = makeJournal()
        journal.record({
            aggregateId: 'foo',
            revision: 1,
            facts: ['one', 'two']
        })
        journal.record({
            aggregateId: 'foo',
            revision: 2,
            facts: ['three']
        })

        // ACTION
        const records = []
        return journal.iterate(r => records.push(r))

            //EXPECTATION
            .then(() => t.deepEqual(records, [{
                aggregateId: 'foo',
                revision: 1,
                facts: ['one', 'two'],
            }, {
                aggregateId: 'foo',
                revision: 2,
                facts: ['three'],
            }]))
    })

    test('Sort records by revision with ' + name, t => {
        // CONDITION
        const journal = makeJournal()
        for (let i = 0; i < 1000; i++) {
            journal.record({
                aggregateId: 'foo',
                revision: i
            })
        }

        // ACTION
        let lastRevision = -1
        return journal.iterate(record => {

            //EXPECTATION
             t.is(record.revision, lastRevision + 1)
             lastRevision = record.revision
        })
    })

    test('Follow records with ' + name, t => {
        // CONDITION
        const journal = makeJournal()
        let followed = []
        journal.follow(record => followed.push(record))
        journal.follow(() => followed.push('two'))

        // ACTION
        return journal.record({
            aggregateId: 'foo',
            revision: 42
        })

            //EXPECTATION
            .then(() => t.deepEqual(followed, [
                {
                    aggregateId: 'foo',
                    revision: 42
                },
                'two'
            ]))
    })

    test('Avoid revision conflicts with ' + name, t => {
        // CONDITION
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

            //EXPECTATION
            .then(() => t.fail('Should have thrown'))
            .catch(err => t.not(err, null))
    })

    test('Purge records of an aggregate with ' + name, t => {
        // CONDITION
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

            //EXPECTATION
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