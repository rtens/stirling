module.exports = class Projection {

    static canAnswer(query) {
        return this.prototype['answer' + query.name]
    }

    answer(query) {
        return this['answer' + query.name](query.arguments)
    }

    apply(fact) {
        this[['apply' + fact.name]] && this[['apply' + fact.name]](fact.attributes)
    }
}