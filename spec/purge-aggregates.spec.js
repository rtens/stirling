const test = require('ava');
const { Aggregate, Fact, Command } = require('..')
const mock = require('./mock')

test('Erase aggregate using ERASED fact', t => {
    // CONTEXT
    const c = mock.context()
    let reacted
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [Fact.ERASED('gone')] }
        })
        .addReaction(class {
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
                    name: 'ERASED',
                    attributes: 'gone'
                }]
            }, {
                erased: 'foo'
            }])
            t.deepEqual(reacted, {
                name: 'ERASED',
                attributes: 'gone'
            })
            t.deepEqual(c.log.infos.slice(2), [{
                trace: 'here',
                message: 'Erasing',
                attributes: {
                    aggregateId: 'foo',
                },
            }])
        })
})