module.exports = class Aggregate {

    static canExecute(command) {
        return this.prototype['execute' + command.name]
            && this.identify(command)
    }

    static identify(command) {
        const identifierName = this.name[0].toLowerCase() + this.name.slice(1) + 'Id'

        return command.arguments
            && command.arguments[identifierName]
    }

    execute(command) {
        return this['execute' + command.name](command.arguments)
    }

    apply(event) {
        this['apply' + event.name] && this['apply' + event.name](event.attributes)
    }
}