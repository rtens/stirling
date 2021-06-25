module.exports = class Query {
    constructor(name) {
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