const test = require('ava');
const mock = require('./mock')
const { Command, Aggregate, Fact, Violation } = require('..')

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
            t.deepEqual(e.details, {
                name: 'Foo',
                arguments: 'bar'
            })
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
                    name: 'Foo',
                    arguments: 'bar'
                }
            }])
        })
})

test('Execute command', t => {
    // CONDITION
    let executed
    const c = mock.context()
    c.registry
        .addAggregate(class {
            static canExecute() {
                return true
            }
            static identify() {
                return 'foo'
            }
            execute(command) {
                executed = { ...command }
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo')
        .withArguments('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(executed, {
                name: 'Foo',
                arguments: 'bar',
                trace: 'here'
            })
            t.deepEqual(c.journal.recorded, [])
            t.deepEqual(c.log.infos.slice(1), [{
                trace: 'here',
                message: 'Executed',
                attributes: undefined
            }])
        })
})

test('Record facts', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addAggregate(class {
            static canExecute(command) {
                return command.name == 'Foo'
            }
            static identify(command) {
                return command.arguments
            }
            execute() {
                return [
                    new Fact('Food', 'one'),
                    new Fact('Bard', 'two')
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
                facts: [{
                    name: 'Food',
                    attributes: 'one'
                }, {
                    name: 'Bard',
                    attributes: 'two'
                }]
            }])
            t.deepEqual(c.log.infos.slice(1), [{
                trace: 'here',
                message: 'Executed',
                attributes: {
                    trace: 'here',
                    aggregateId: 'bar',
                    revision: 0,
                    facts: [{
                        name: 'Food', 
                        attributes: 'one'
                    }, {
                        name: 'Bard',
                        attributes: 'two'
                    }]
                }
            }])
        })
})

test('Find first that can execute the command', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addAggregate(class {
            static canExecute() {
                return false
            }
        })
        .addAggregate(class {
            static canExecute() {
                return true
            }
            static identify() {
                return 'foo'
            }
            execute() {
                return [new Fact('food')]
            }
        })
        .addAggregate(class {
            static canExecute() {
                return true
            }
            static identify() {
                return 'bar'
            }
            execute() {
                return [new Fact('bard')]
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
                facts: [{
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
        revision: 7,
        facts: 'one'
    }, {
        aggregateId: 'bar',
        revision: 21,
        facts: 'not'
    }, {
        aggregateId: 'foo',
        revision: 42,
        facts: 'two'
    }]

    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'foo' }

            apply(record) {
                this.applied = [...(this.applied || ['zero']), record.facts]
            }
            execute() {
                return [new Fact('Done', this.applied)]
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
                facts: [{
                    name: 'Done',
                    attributes: [
                        'zero',
                        'one',
                        'two'
                    ]
                }]
            }])
        })
})

test('Reject violating execution', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'bar' }
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
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'bar' }
            execute() { throw 'Boom!' }
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
});

test('Reject unidentified command', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addAggregate(class {
            static identify() { return null }
            static canExecute() { return true }
            execute() { return [new Fact('Food')] }
        })

    // ACTION
    return c.service.execute(new Command('Foo'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => {
            t.is(e.message, 'Could not identify aggregate. Got: null')
            t.is(c.log.errors[0].error, e)
        })
})

test('Provide defaults by convention', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [{
        aggregateId: 'foo',
        revision: 42,
        facts: [{
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

    c.registry
        .addAggregate(class One extends Aggregate {
            applyFood(attributes) {
                this.applied = [attributes]
            }
            applyBazd(attributes) {
                this.applied.push(attributes)
            }
            executeFoo(args) {
                return [new Fact('Done', { args, ...this })]
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
                facts: [{
                    name: 'Done',
                    attributes: {
                        args: { oneId: 'foo' },
                        applied: ['one', 'two']
                    }
                }]
            }])
        })
})