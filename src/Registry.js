const Violation = require('./Violation')

module.exports = class Registry {
    constructor() {
        this.aggregates = []
        this.projections = []
        this.reactions = []
    }

    addAggregate(aggregateClass) {
        this.aggregates.push(aggregateClass)
        return this
    }

    findAggregateExecuting(command) {
        return this.aggregates.find(e => e.canExecute(command))
            || Promise.reject(new Violation.UnknownCommand(command.attributes()))
    }

    addProjection(projection) {
        this.projections.push(projection)
        return this
    }

    findProjectionAnswering(query) {
        return this.projections.find(e => e.canAnswer(query))
            || Promise.reject(new Violation.UnknownQuery(query.attributes()))
    }

    addReaction(reaction) {
        this.reactions.push(reaction)
        return this
    }

    allReactions() {
        return this.reactions
    }
}