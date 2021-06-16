module.exports = class Projection {

    static canAnswer(query) {
        return this.prototype['answer' + query.name]
    }

    answer(query) {
        return this['answer' + query.name](query.parameters)
    }

    apply(event) {
        this[['apply' + event.name]] && this[['apply' + event.name]](event.attributes)
    }
}