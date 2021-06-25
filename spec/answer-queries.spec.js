const test = require('ava');
const mock = require('./mock')
const { Query, Projection, Violation } = require('..')

test('Reject unknown query', t => {
    // CONDITION
    const c = mock.context()

    // ACTION
    return c.service.answer(new Query('Foo')
        .withArguments('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => {
            t.assert(e instanceof Violation.UnknownQuery)
            t.deepEqual(e.details, {
                name: 'Foo',
                arguments: 'bar'
            })
        })
        .then(() => {
            t.deepEqual(c.log.infos, [{
                trace: 'here',
                message: 'Answering',
                attributes: {
                    name: 'Foo',
                    arguments: 'bar'
                }
            }, {
                trace: 'here',
                message: 'Violation: UNKNOWN_QUERY',
                attributes: {
                    name: 'Foo',
                    arguments: 'bar'
                }
            }])
        })
})

test('Return answer', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addProjection(class {
            static canAnswer(query) {
                return query.name == 'Foo'
            }
            answer(query) {
                return [query.name, query.arguments]
            }
        })

    // ACTION
    return c.service.answer(new Query('Foo')
        .withArguments('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(answer => {
            t.deepEqual(answer, ['Foo', 'bar'])
            t.deepEqual(c.log.infos.slice(1), [{
                trace: 'here',
                message: 'Answered',
                attributes: undefined
            }])
        })
})

test('Find first that can answer', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addProjection(class {
            static canAnswer() { return false }
        })
        .addProjection(class {
            static canAnswer() { return true }
            answer() { return 42 }
        })
        .addProjection(class {
            static canAnswer() { return true }
            answer() { return 21 }
        })

    // ACTION
    return c.service.answer(new Query('Foo'))

        // EXPECTATION
        .then(response => {
            t.is(response, 42)
        })
})

test('Reject violating answer', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addProjection(class {
            static canAnswer() { return true }
            answer() {
                throw new Violation.Generic('BOOM', 'Something went boom', { went: 'boom' })
            }
        })

    // ACTION
    return c.service.answer(new Query('Foo')
        .withTrace('here'))

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

test('Reject failing answer', t => {
    // CONDITION
    const c = mock.context()
    c.registry
        .addProjection(class {
            static canAnswer() { return true }
            answer() {
                throw 'Boom!'
            }
        })

    // ACTION
    return c.service.answer(new Query('Foo')
        .withTrace('here'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => t.is(e, 'Boom!'))
        .then(() => t.deepEqual(c.log.errors, [{
            trace: 'here',
            error: 'Boom!'
        }]))
})

test('Reconstitute projection', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [
        { facts: 'one' },
        { facts: 'two' }
    ]
    c.registry
        .addProjection(class {
            static canAnswer() { return true }
            answer() {
                return { ...this }
            }
            project(record) {
                this.projected = [...(this.projected || ['zero']), record.facts]
            }
        })

    // ACTION
    return c.service.answer(new Query('Foo'))

        // EXPECTATION
        .then(response => {
            t.deepEqual(response, {
                projected: ['zero', 'one', 'two']
            })
        })
})

test('Provide defaults by convention', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [{
        facts: [
            { name: 'Food', attributes: 'foo' },
            { name: 'Bard', attributes: 'bar' },
            { name: 'Bazd', attributes: 'baz' },
        ]
    }]
    c.registry
        .addProjection(class extends Projection {
            answerFoo() {
                return ['Foo', ...this.applied]
            }
            projectFood(attributes) {
                this.applied = [attributes]
            }
            projectBazd(attributes) {
                this.applied.push(attributes)
            }
        })
        .addProjection(class extends Projection {
            answerBar() {
                return ['Bar', this.projected]
            }
            projectBard(attributes) {
                this.projected = attributes
            }
        })

    // ACTION
    return Promise.all([
        c.service.answer(new Query('Foo')),
        c.service.answer(new Query('Bar'))
    ])

        // EXPECTATION
        .then(([foo, bar]) => {
            t.deepEqual(foo, ['Foo', 'foo', 'baz'])
            t.deepEqual(bar, ['Bar', 'bar'])
        })
})