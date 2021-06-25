class Generic extends Error {
    constructor(message, comment, details) {
        super(message)
        this.comment = comment
        this.details = details
    }

    asObject(trace) {
        return {
            trace,
            error: this.message,
            message: this.comment,
            details: this.details
        }
    }
}

class UnknownCommand extends Generic {
    constructor(details) {
        super('UNKNOWN_COMMAND', 'This command is unknown. Did you misspell it?', details)
    }
}

class UnknownQuery extends Generic {
    constructor(details) {
        super('UNKNOWN_QUERY', 'This query is unknown. Did you misspell it?', details)
    }
}

class BusinessRule extends Generic {
    constructor(rule) {
        super('BUSINESS_RULE_VIOLATED', 'This command violate a business rule and was therefore rejected.', { rule })
    }
}

module.exports = {
    Generic,
    UnknownCommand,
    UnknownQuery,
    BusinessRule,
}