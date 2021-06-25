module.exports = class Reaction {

    reactTo(record) {
        record.facts
            .filter(fact => this[['reactTo' + fact.name]])
            .forEach(fact => this[['reactTo' + fact.name]](fact.attributes))
    }
}