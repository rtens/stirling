module.exports = class Fact {
    constructor(name, attributes = null) {
        this.name = name
        this.attributes = attributes
    }

    static ERASED(attributes = null) {
        return new Fact('ERASED', attributes)
    }
}