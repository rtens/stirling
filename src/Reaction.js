const Entity = require('./Entity')

module.exports = class Reaction extends Entity {

    reactTo(record) {
        record.facts
            .filter(fact => this[['reactTo' + fact.name]])
            .forEach(fact => this[['reactTo' + fact.name]](fact.attributes))
    }
}