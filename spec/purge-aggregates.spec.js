const test = require('ava');
const { Aggregate, Fact, Command } = require('..')
const mock = require('./mock')

test('Purge aggregate using PURGED fact', t => {
    // CONTEXT
    const c = mock.context()
    let reacted
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [Fact.PURGED('gone')] }
        })
        .register(class {
            static canReactTo() {
                return true
            }
            reactTo(record) {
                reacted = {...record.facts[0]}
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATIONS
        .then(() => {
            t.deepEqual(c.journal.recorded, [{
                trace: 'here',
                aggregateId: 'foo',
                revision: 0,
                facts: [{
                    name: 'PURGED',
                    attributes: 'gone'
                }]
            }, {
                purged: 'foo'
            }])
            t.deepEqual(reacted, {
                name: 'PURGED',
                attributes: 'gone'
            })
            t.deepEqual(c.log.infos.slice(2), [{
                trace: 'here',
                message: 'Purging',
                attributes: {
                    aggregateId: 'foo',
                },
            }])
        })
})