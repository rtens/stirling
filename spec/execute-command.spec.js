const test = require('ava');
const mock = require('./mock')
const { Command, Aggregate, Event, Violation } = require('..')

test('Reject unknown command', t => {
    // CONDITION
    const c = mock.context()

    // ACTION
    return c.service.execute(new Command('Foo')
        .withArguments('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => {
            t.assert(e instanceof Violation.UnknownCommand)
            t.deepEqual(e.details, { command: { name: 'Foo', arguments: 'bar' } })
        })
        .then(() => {
            t.deepEqual(c.journal.recorded, [])
            t.deepEqual(c.log.infos, [{
                trace: 'here',
                message: 'Executing',
                attributes: {
                    name: 'Foo',
                    arguments: 'bar'
                }
            }, {
                trace: 'here',
                message: 'Violation: UNKNOWN_COMMAND',
                attributes: {
                    command: {
                        name: 'Foo',
                        arguments: 'bar'
                    }
                }
            }])
        })
})

test('Record events', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static identify(command) {
                return command.arguments
            }
            static canExecute(command) {
                return command.name == 'Foo'
            }
            execute(command) {
                return [
                    new Event(command.name + 'd', command.arguments),
                    new Event('Bard', 'two')
                ]
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo')
        .withArguments('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(c.journal.recorded, [{
                trace: 'here',
                aggregateId: 'bar',
                revision: 0,
                events: [{
                    name: 'Food',
                    attributes: 'bar'
                }, {
                    name: 'Bard',
                    attributes: 'two'
                }]
            }])

            t.deepEqual(c.log.infos.slice(1), [{
                trace: 'here',
                message: 'Executed',
                attributes: undefined
            }])
        })
})

test('Find first who can execute the command', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
        })
        .register(class {
            static canExecute() {
                return false
            }
        })
        .register(class {
            static identify() {
                return 'foo'
            }
            static canExecute() {
                return true
            }
            execute() {
                return [new Event('food')]
            }
        })
        .register(class {
            static canExecute() {
                return true
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo')
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(c.journal.recorded, [{
                trace: 'here',
                aggregateId: 'foo',
                revision: 0,
                events: [{
                    name: 'food',
                    attributes: null
                }]
            }])
        })
})

test('Reconstitute aggregate', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [{
        aggregateId: 'foo',
        events: ['one', 'two']
    }, {
        aggregateId: 'bar',
        events: ['not']
    }, {
        aggregateId: 'foo',
        revision: 42,
        events: ['three']
    }]

    c.service
        .register(class {
            static identify() {
                return 'foo'
            }
            static canExecute() {
                return true
            }
            execute() {
                return [new Event('Done', this.applied)]
            }
            apply(event) {
                this.applied = [...(this.applied || ['zero']), event]
            }
        })

    // ACTION
    return c.service.execute((new Command('Foo')
        .withTrace('here')))

        // EXPECTATION
        .then(() => {
            t.deepEqual(c.journal.recorded, [{
                trace: 'here',
                aggregateId: 'foo',
                revision: 43,
                events: [{
                    name: 'Done',
                    attributes: [
                        'zero',
                        'one',
                        'two',
                        'three'
                    ]
                }]
            }])
        })
})

test('Reject violating execution', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static identify() {
                return 'bar'
            }
            static canExecute() {
                return true
            }
            execute() {
                throw new Violation.Generic('BOOM', 'Something went boom', { went: 'boom' })
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo').withTrace('here'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => t.is(e.message, 'BOOM'))
        .then(() => {
            t.deepEqual(c.journal.recorded, [])
            t.deepEqual(c.log.infos.slice(1), [{
                trace: 'here',
                message: 'Violation: BOOM',
                attributes: { went: 'boom' }
            }])
            t.deepEqual(c.log.errors, [])
        })
})

test('Reject failing execution', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static identify() {
                return 'bar'
            }
            static canExecute() {
                return true
            }
            execute() {
                throw 'Boom!'
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo').withTrace('here'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => t.is(e, 'Boom!'))
        .then(() => t.deepEqual(c.journal.recorded, []))
        .then(() => t.deepEqual(c.log.errors, [{
            trace: 'here',
            error: 'Boom!'
        }]))
})

test('Reject execution not returning anything', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static identify() { return 'foo' }
            static canExecute() { return true }
            execute() { }
        })

    // ACTION
    return c.service.execute(new Command('Foo'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => {
            t.is(e.message, 'Execution did not return any events')
            t.is(c.log.errors[0].error, e)
        })
})

test('Reject execution returning zero events', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static identify() { return 'foo' }
            static canExecute() { return true }
            execute() { return [] }
        })

    // ACTION
    return c.service.execute(new Command('Foo'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => {
            t.is(e.message, 'Execution did not return any events')
            t.is(c.log.errors[0].error, e)
        })
})

test('Provide defaults by convention', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [{
        aggregateId: 'foo',
        revision: 42,
        events: [{
            name: 'Food',
            attributes: 'one'
        }, {
            name: 'Bard',
            attributes: 'not'
        }, {
            name: 'Bazd',
            attributes: 'two'
        }]
    }]

    c.service
        .register(class One extends Aggregate {
            executeFoo(args) {
                return [new Event('Done', { args, ...this })]
            }
            applyFood(attributes) {
                this.applied = [attributes]
            }
            applyBazd(attributes) {
                this.applied.push(attributes)
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo')
        .withArguments({ oneId: 'foo' })
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(c.journal.recorded, [{
                trace: 'here',
                aggregateId: 'foo',
                revision: 43,
                events: [{
                    name: 'Done',
                    attributes: {
                        args: { oneId: 'foo' },
                        applied: ['one', 'two']
                    }
                }]
            }])
        })
})