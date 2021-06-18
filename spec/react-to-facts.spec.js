const test = require('ava');
const mock = require('./mock')
const { Command, Fact } = require('..')

test('React to fact', t => {
    // CONDITION
    const c = mock.context()
    let reacted
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [new Fact('Food', 'bar')] }
        })
        .register(class {
            static canReactTo(fact) {
                return fact.name == 'Food'
            }
            reactTo(fact, trace) {
                reacted = { ...fact, trace }
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
                trace: 'here_0'
            })
        })
})

test('Log thrown errors', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [new Fact('Food', 'bar')] }
        })
        .register(class {
            static canReactTo() {
                return true
            }
            reactTo() {
                throw 'Boom!'
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(c.log.errors, [{
                trace: 'here_0',
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
            static identify() { return 'foo' }
            execute() {
                return [
                    new Fact('Food'),
                    new Fact('Bard')
                ]
            }
        })
        .register(class {
            static canReactTo(fact) {
                return fact.name == 'Food'
            }
            reactTo(fact) {
                reacted.push(['one', fact.name])
            }
        })
        .register(class {
            static canReactTo() {
                return true
            }
            reactTo(fact) {
                reacted.push(['two', fact.name])
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, [
                ['one', 'Food'],
                ['two', 'Food'],
                ['two', 'Bard'],
            ])
            t.deepEqual(c.log.infos, [{
                trace: 'here',
                message: 'Executing',
                attributes: {
                    arguments: undefined,
                    name: undefined,
                },
            }, {
                trace: 'here',
                message: 'Executed',
                attributes: undefined,
            }, {
                trace: 'here_0',
                message: 'Reacting',
                attributes: {
                    fact: {
                        attributes: null,
                        name: 'Food',
                    },
                },
            }, {
                trace: 'here_1',
                message: 'Reacting',
                attributes: {
                    fact: {
                        attributes: null,
                        name: 'Food',
                    },
                },
            }, {
                trace: 'here_2',
                message: 'Reacting',
                attributes: {
                    fact: {
                        attributes: null,
                        name: 'Bard',
                    },
                },
            }])
        })
})