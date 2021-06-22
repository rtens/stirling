const Entity = require('./Entity')

module.exports = class Projection extends Entity {

    static canAnswer(query) {
        return this.prototype['answer' + query.name]
    }

    answer(query) {
        return this['answer' + query.name](query.arguments)
    }
}