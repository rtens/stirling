module.exports = class Fact {
    constructor(name, attributes = null) {
        this.name = name
        this.attributes = attributes
    }

    static PURGED(attributes = null) {
        return new Fact('PURGED', attributes)
    }
}