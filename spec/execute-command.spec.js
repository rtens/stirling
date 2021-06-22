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
            t.assert(e instanceof Violation.UnknownAction)
            t.deepEqual(e.details, {
                action: 'command',
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
                message: 'Violation: UNKNOWN_ACTION',
                attributes: {
                    action: 'command',
                    name: 'Foo',
                    arguments: 'bar'
                }
            }])
        })
})

test('Record facts', t => {
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
                    new Fact(command.name + 'd', command.arguments),
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
                return [new Fact('food')]
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
        revision: 42,
        facts: 'one'
    }, {
        aggregateId: 'bar',
        revision: 21,
        facts: 'two'
    }, {
        aggregateId: 'baz',
        revision: 7,
        facts: 'three'
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
                return [new Fact('Done', this.applied)]
            }
            apply(record) {
                this.applied = [...(this.applied || ['zero']), record.facts]
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
                        'two',
                        'three'
                    ]
                }]
            }])
        })
})

test('Do not reconstitute if entity has no apply method', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [{
        aggregateId: 'foo',
        revision: 42,
        facts: 'one'
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
                return [new Fact('Done')]
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
                    attributes: null
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
});

[
    ['nothing', null],
    ['an empty list', []],
    ['no facts', [new Fact(), 'no fact']]
].forEach(([description, returnValue]) =>
    test('Reject execution returning ' + description, t => {
        // CONDITION
        const c = mock.context()
        c.service
            .register(class {
                static identify() { return 'foo' }
                static canExecute() { return true }
                execute() { return returnValue }
            })

        // ACTION
        return c.service.execute(new Command('Foo'))

            // EXPECTATION
            .then(() => t.fail('Should have rejected'))
            .catch(e => {
                t.is(e.message, 'Execution did not return a list of facts')
                t.is(c.log.errors[0].error, e)
            })
    }))

test('Reject unidentified command', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
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
    }, {
        aggregateId: 'bar',
        facts: [{
            name: 'Food',
            attributes: 'not'
        }]
    }]

    c.service
        .register(class One extends Aggregate {
            executeFoo(args) {
                return [new Fact('Done', { args, ...this })]
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
                facts: [{
                    name: 'Done',
                    attributes: {
                        args: { oneId: 'foo' },
                        id: 'foo',
                        applied: ['one', 'two']
                    }
                }]
            }])
        })
})