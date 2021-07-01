const test = require('ava');
const mock = require('./mock')
const { Command, Fact, Reaction } = require('..')

test('React to fact', t => {
    // CONDITION
    let reacted
    const c = mock.context()
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [new Fact('Food', 'bar')] }
        })
        .addReaction(class {
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
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() { return [new Fact('Food', 'bar')] }
        })
        .addReaction(class {
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

test('React multiple times', t => {
    // CONDITION
    const c = mock.context()
    let reacted = []
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() {
                return [
                    new Fact('Food'),
                    new Fact('Bard')
                ]
            }
        })
        .addReaction(class {
            reactTo(record) {
                reacted.push(['one', record.facts[0].name])
            }
        })
        .addReaction(class {
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
    c.registry
        .addAggregate(class {
            static canExecute() { return true }
            static identify() { return 'foo' }
            execute() {
                return [
                    new Fact('Food', 'foo'),
                    new Fact('Bard', 'bar'),
                    new Fact('Bazd', 'baz')
                ]
            }
        })
        .addReaction(class extends Reaction {
            reactToFood(attributes) {
                reacted.push(['food', attributes])
            }
            reactToBazd(attributes) {
                reacted.push(['bazd', attributes])
            }
        })

    // ACTION
    return c.service.execute(new Command('Foo')
        .withTrace('here'))

        // EXPECTATION
        .then(() => {
            t.deepEqual(reacted, [
                ['food', 'foo'],
                ['bazd', 'baz']
            ])
        })
})