const test = require('ava');
const ExpressServer = require('../src/ExpressServer')
const { Violation } = require('..')

test('Execute command with POST request', t => {
    // CONDITION
    let executed
    const service = {
        execute: command => {
            executed = { ...command }
            return Promise.resolve(true)
        }
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const req = {
        params: { command: 'DoFoo' },
        body: 'bar'
    }
    const res = new Response()
    return server.post(req, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            end: true
        })
        t.deepEqual(executed, {
            trace: 'random',
            name: 'DoFoo',
            arguments: 'bar'
        })
    })
})

test('Answer query with GET request', t => {
    // CONDITION
    let answered
    const service = {
        answer: query => {
            answered = { ...query }
            return Promise.resolve('yes')
        }
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const req = {
        params: { query: 'IsFoo' },
        query: 'bar'
    }
    const res = new Response()
    return server.get(req, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            send: 'yes',
            end: true
        })
        t.deepEqual(answered, {
            trace: 'random',
            name: 'IsFoo',
            arguments: 'bar'
        })
    })
})

test('Respond with 404 if command is unknown', t => {
    // CONDITION
    const service = {
        execute: () => Promise.reject(new Violation.UnknownCommand('SomeCommand')),
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const res = new Response()
    return server.post({ params: {}, body: {} }, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            status: 404,
            send: {
                trace: 'random',
                error: 'UNKNOWN_COMMAND',
                message: 'This command is unknown. Did you misspell it?',
                details: 'SomeCommand'
            },
            end: true
        })
    })
})

test('Respond with 404 if query or command is unknown', t => {
    // CONDITION
    const service = {
        answer: () => Promise.reject(new Violation.UnknownQuery('SomeQuery'))
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const res = new Response()
    return server.get({ params: {}, body: {} }, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            status: 404,
            send: {
                trace: 'random',
                error: 'UNKNOWN_QUERY',
                message: 'This query is unknown. Did you misspell it?',
                details: 'SomeQuery'
            },
            end: true
        })
    })
})

test('Respond with 409 if command violates a business rule', t => {
    // CONDITION
    const service = {
        execute: () => Promise.reject(new Violation.BusinessRule('Easily violated'))
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const res = new Response()
    return server.post({ params: {} }, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            status: 409,
            send: {
                trace: 'random',
                error: 'BUSINESS_RULE_VIOLATED',
                message: 'This command violate a business rule and was therefore rejected.',
                details: {
                    rule: 'Easily violated'
                }
            },
            end: true
        })
    })
})

test('Respond with 400 for generic violations', t => {
    // CONDITION
    const service = {
        execute: () => Promise.reject(new Violation.Generic('DANGER', 'Something went wrong', 'What else?'))
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const res = new Response()
    return server.post({ params: {} }, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            status: 400,
            send: {
                trace: 'random',
                error: 'DANGER',
                message: 'Something went wrong',
                details: 'What else?'
            },
            end: true
        })
    })
})

test('Respond with 500 for thrown errors', t => {
    // CONDITION
    const service = {
        execute: () => Promise.reject('Boom!')
    }
    const server = new ExpressServer(service, random)

    // ACTION
    const res = new Response()
    return server.post({ params: {} }, res).then(() => {

        // EXPECTATION
        t.deepEqual(res.set, {
            status: 500,
            send: {
                trace: 'random',
                error: 'UNEXPECTED_ERROR',
                message: 'An unexpected error ocurred. Please try again later.'
            },
            end: true
        })
    })
})

const random = () => 'random'

class Response {
    constructor() {
        this.set = {}
    }

    status(s) {
        this.set.status = s
        return this
    }

    send(d) {
        this.set.send = d
        return this
    }

    end() {
        this.set.end = true
        return this
    }
}