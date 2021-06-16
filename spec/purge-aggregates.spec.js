const test = require('ava');
const { Aggregate, Event, Command } = require('..')
const mock = require('./mock')

test('Purge aggregate using PURGED event', t => {
    // CONTEXT
    const c = mock.context()
    let reacted
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [Event.PURGED('gone')] }
        })
        .register(class {
            reactTo(event) {
                reacted = event
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
                events: [{
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
        })
})