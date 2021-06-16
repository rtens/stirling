module.exports = class Query {
    constructor(name) {
        this.trace = defaultTrace()
        this.name = name
    }

    withParameters(parameters) {
        this.parameters = parameters
        return this
    }

    withTrace(trace) {
        this.trace = trace
        return this
    }

    attributes() {
        return {
            name: this.name,
            parameters: this.parameters
        }
    }
}

function defaultTrace() {
    return 'TC_'
        + Buffer.from('' + Math.random())
            .toString('base64')
            .substr(-10, 7)
}