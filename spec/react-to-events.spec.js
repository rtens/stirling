const test = require('ava');
const mock = require('./mock')
const { Command, Aggregate, Event, Violation } = require('..')

test('React to event', t => {
    // CONDITION
    const c = mock.context()
    let reacted
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return null }
            execute() { return [new Event('Food', 'bar')] }
        })
        .register(class {
            reactTo(event, trace) {
                reacted = { ...event, trace }
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, {
                name: 'Food',
                attributes: 'bar',
                trace: 'here_R0'
            })
        })
})

test('Log thrown errors', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return null }
            execute() { return [new Event('Food', 'bar')] }
        })
        .register(class {
            reactTo(event) {
                throw 'Boom!'
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(c.log.errors, [{
                trace: 'here_R0',
                error: 'Boom!'
            }])
        })
})

test('React multiple times', t => {
    // CONDITION
    const c = mock.context()
    let reacted = []
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return null }
            execute() { return [new Event('Food', 'bar')] }
        })
        .register(class {
            reactTo() {
                reacted.push('one')
            }
        })
        .register(class {
            reactTo() {
                reacted.push('two')
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, ['one', 'two'])
        })
})