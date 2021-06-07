var m = require('./methods')

async function main() {
    var v = await m.balance('0xeA7D9225F74BF8206Ac8d9AD358b7Cc2c716EE89', '0xeA7D9225F74BF8206Ac8d9AD358b7Cc2c716EE89')

    console.log(v)
}

main()