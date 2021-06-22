module.exports = class Entity {
    constructor(id) {
        this.id = id
    }

    apply(record) {
        record.facts
            .filter(fact => this[['apply' + fact.name]])
            .forEach(fact => this[['apply' + fact.name]](fact.attributes))
    }
}