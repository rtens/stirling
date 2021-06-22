module.exports = {
    Service: require('./src/Service'),
    Command: require('./src/Action'),
    Aggregate: require('./src/Aggregate'),
    Query: require('./src/Action'),
    Projection: require('./src/Projection'),
    Reaction: require('./src/Reaction'),
    Violation: require('./src/Violation'),
    Fact: require('./src/Fact'),
    ConsoleLog: require('./src/ConsoleLog'),
    NeDbJournal: require('./src/NeDbJournal'),
    ExpressServer: require('./src/ExpressServer'),
}