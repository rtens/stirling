module.exports = class Event {
    constructor(name, attributes = null) {
        this.name = name
        this.attributes = attributes
    }

    static PURGED(attributes = null) {
        return new Event('PURGED', attributes)
    }
}