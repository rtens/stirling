const Entity = require('./Entity')

module.exports = class Aggregate extends Entity {

    static canExecute(command) {
        return this.prototype['execute' + command.name]
            && this.identify(command)
    }

    static identify(action) {
        const identifierName = this.name[0].toLowerCase() + this.name.slice(1) + 'Id'

        return action.arguments
            && action.arguments[identifierName]
    }

    execute(command) {
        return this['execute' + command.name](command.arguments)
    }

    apply(record) {
        if (record.aggregateId != this.id) return
        super.apply(record)
    }
}