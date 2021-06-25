module.exports = class Projection {

    static canAnswer(query) {
        return this.prototype['answer' + query.name]
    }

    project(record) {
        record.facts
            .filter(fact => this[['project' + fact.name]])
            .forEach(fact => this[['project' + fact.name]](fact.attributes))
    }

    answer(query) {
        return this['answer' + query.name](query.arguments)
    }
}