module.exports = class Aggregate {

    static canExecute(command) {
        return this.prototype['execute' + command.name]
            && this.identify(command)
    }

    static identify(action) {
        const identifierName = this.name[0].toLowerCase() + this.name.slice(1) + 'Id'

        return action.arguments
            && action.arguments[identifierName]
    }

    apply(record) {
        record.facts
            .filter(fact => this[['apply' + fact.name]])
            .forEach(fact => this[['apply' + fact.name]](fact.attributes))
    }

    execute(command) {
        return this['execute' + command.name](command.arguments)
    }
}