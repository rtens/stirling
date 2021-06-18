const express = require('express')
const Violation = require('./Violation')
const Action = require('./Action')

module.exports = class ExpressServer {
    constructor(service, random = defaultRandom) {
        this.service = service
        this.random = random
    }

    run(port) {
        this.app = express()
        this.app.use(express.json({ type: '*/*' }))

        this.app.post('/:command', (req, res) => this.post(req, res))
        this.app.get('/:query', (req, res) => this.get(req, res))

        this.app.listen(port, () =>
            console.log(`Running at http://localhost:${port}`))
    }

    post(req, res) {
        const trace = this.random()

        return this.service.execute(new Action(req.params.command)
            .withArguments(req.body)
            .withTrace(trace))
            .then(() => res.end())
            .catch(e => handleError(e, trace, res))
    }

    get(req, res) {
        const trace = this.random()

        return this.service.answer(new Action(req.params.query)
            .withArguments(req.query)
            .withTrace(trace))
            .then(answer => res.send(answer).end())
            .catch(e => handleError(e, trace, res))
    }
}

function handleError(error, trace, res) {
    if (error instanceof Violation.Generic) {
        res.status(errorStatus(error)).send(error.asObject(trace)).end()
    } else {
        res.status(500).send({
            trace,
            error: 'UNEXPECTED_ERROR',
            message: 'An unexpected error ocurred. Please try again later.'
        }).end()
    }
}

function errorStatus(violation) {
    if (violation instanceof Violation.UnknownAction) return 404
    if (violation instanceof Violation.BusinessRule) return 409
    return 400
}

function defaultRandom(length = 7) {
    return Buffer.from('' + Math.random())
            .toString('base64')
            .substr(-length - 3, length)
}