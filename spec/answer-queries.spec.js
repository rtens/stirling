const test = require('ava');
const mock = require('./mock')
const { Query, Projection, Violation } = require('..')

test('Reject unknown query', t => {
    // CONDITION
    const c = mock.context()

    // ACTION
    return c.service.answer(new Query('Foo')
        .withParameters('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(() => t.fail('Should have rejected'))
        .catch(e => {
            t.assert(e instanceof Violation.UnknownQuery)
            t.deepEqual(e.details, {
                query: {
                    name: 'Foo',
                    parameters: 'bar'
                }
            })
        })
        .then(() => {
            t.deepEqual(c.log.infos, [{
                trace: 'here',
                message: 'Answering',
                attributes: {
                    name: 'Foo',
                    parameters: 'bar'
                }
            }, {
                trace: 'here',
                message: 'Violation: UNKNOWN_QUERY',
                attributes: {
                    query: {
                        name: 'Foo',
                        parameters: 'bar'
                    }
                }
            }])
        })
})

test('Respond with answer', t => {
    // CONDITION
    const c = mock.context()
    c.service
        .register(class {
            static canAnswer(query) {
                return query.name == 'Foo'
            }
            answer(query) {
                return [query.name, query.parameters]
            }
        })

    // ACTION
    return c.service.answer(new Query('Foo')
        .withParameters('bar')
        .withTrace('here'))

        // EXPECTATION
        .then(response => {
            t.deepEqual(response, ['Foo', 'bar'])
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
    c.service
        .register(class {
        })
        .register(class {
            static canAnswer() {
                return false
            }
        })
        .register(class {
            static canAnswer() {
                return true
            }
            answer() {
                return 42
            }
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
    c.service
        .register(class {
            static canAnswer() {
                return true
            }
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
    c.service
        .register(class {
            static canAnswer() {
                return true
            }
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
        { events: ['one', 'two'] },
        { events: ['three'] }
    ]
    c.service
        .register(class {
            static canAnswer() {
                return true
            }
            answer() {
                return { ...this }
            }
            apply(event) {
                this.applied = [...(this.applied || ['zero']), event]
            }
        })

    // ACTION
    return c.service.answer(new Query('Foo'))

        // EXPECTATION
        .then(response => {
            t.deepEqual(response, {
                applied: ['zero', 'one', 'two', 'three']
            })
        })
})

test('Provide defaults by convention', t => {
    // CONDITION
    const c = mock.context()
    c.journal.records = [{
        events: [
            { name: 'Food', attributes: 'foo' },
            { name: 'Bard', attributes: 'bar' },
            { name: 'Bazd', attributes: 'baz' },
        ]
    }]
    c.service
        .register(class extends Projection {
            answerFoo() {
                return ['Foo', ...this.applied]
            }
            applyFood(attributes) {
                this.applied = [attributes]
            }
            applyBazd(attributes) {
                this.applied.push(attributes)
            }
        })
        .register(class extends Projection {
            answerBar() {
                return ['Bar', this.applied]
            }
            applyBard(attributes) {
                this.applied = attributes
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