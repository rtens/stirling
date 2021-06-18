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

class UnknownAction extends Generic {
    constructor(details) {
        super('UNKNOWN_ACTION', 'This action is unknown. Did you misspell it?', details)
    }
}

class BusinessRule extends Generic {
    constructor(rule) {
        super('BUSINESS_RULE_VIOLATED', 'This command violate a business rule and was therefore rejected.', { rule })
    }
}

module.exports = {
    Generic,
    UnknownAction,
    BusinessRule,
}