 module.exports = class ConsoleLog {
     error(trace, message, error) {
         console.error(`[${trace}]`, message, error ? error : '')
     }

     info(trace, message, attributes) {
         console.log(`[${trace}]`, message, attributes ? JSON.stringify(attributes) : '')
     }
 }