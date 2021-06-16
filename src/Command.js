module.exports = class Command {
    constructor(name) {
        this.trace = defaultTrace()
        this.name = name
    }

    withArguments(args) {
        this.arguments = args
        return this
    }

    withTrace(trace) {
        this.trace = trace
        return this
    }

    attributes() {
        return {
            name: this.name,
            arguments: this.arguments
        }
    }
}

function defaultTrace() {
    return 'TC_'
        + Buffer.from('' + Math.random())
            .toString('base64')
            .substr(-10, 7)
}