const test = require('ava');
const mock = require('./mock')
const { Command, Fact, Aggregate, Reaction } = require('..')

test('React to fact', t => {
    // CONDITION
    let reacted
    const c = mock.context()
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [new Fact('Food', 'bar')] }
        })
        .register(class {
            reactTo(record) {
                reacted = { ...record.facts[0] }
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, {
                name: 'Food',
                attributes: 'bar'
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
                trace: 'here',
                error: 'Boom!'
            }])
        })
})

test('Reconstitute reaction', t => {
    // CONDITION
    let reacted
    const c = mock.context()
    c.journal.records = [
        { facts: 'one' },
        { facts: 'two' }
    ]
    c.service
        .register(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [new Fact('Food', 'bar')] }
        })
        .register(class {
            apply(record) {
                this.applied = [...(this.applied || ['zero']), record.facts]
            }
            reactTo(record) {
                reacted = { facts: record.facts.map(f => ({ ...f })), applied: this.applied }
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, {
                facts: [{
                    name: 'Food',
                    attributes: 'bar'
                }],
                applied: ['zero', 'one', 'two']
            })
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
            reactTo(record) {
                reacted.push(['one', record.facts[0].name])
            }
        })
        .register(class {
            reactTo(record) {
                reacted.push(['two', record.facts[1].name])
            }
        })

    // ACTION
    return c.service.execute(new Command()
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, [
                ['one', 'Food'],
                ['two', 'Bard'],
            ])
        })
})

test('Provide defaults by convention', t => {
    // CONDITION
    let reacted = []
    const c = mock.context()
    c.service
        .register(class Foo extends Aggregate {
            executeFoo() {
                return [
                    new Fact('Food', 'foo'),
                    new Fact('Bard', 'bar'),
                    new Fact('Bazd', 'baz')
                ]
            }
        })
        .register(class extends Reaction {
            reactToFood(attributes) {
                reacted.push(['food', attributes])
            }
            reactToBazd(attributes) {
                reacted.push(['bazd', attributes])
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo')
        .withArguments({ fooId: 'foo' })
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, [
                ['food', 'foo'],
                ['bazd', 'baz']
            ])
        })
})