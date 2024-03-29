var crypto = require('crypto');
const axios = require('axios')


const TRY = fn => async (req, res) => {
    for (var i = 0; i < 5; i++) {
        try {
            await fn(req, res)
            break;
        }
        catch (ex) {
            console.error(ex.toString())
            if (i == 4) {
                res.status(ex.response.status)
                    .send(ex.response.data)
                break;
            }
            await sleep(100)
        }
    }
}

var sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms)
})

module.exports = (RPC, CHAIN_ID, timeCache = 5000, timeWait = 5000) => {
    var CACHE_RPC = {
        COUNT_KEY: 0
    }
    return TRY(async (req, res) => {
        var body = req.body

        if (body.method == 'eth_chainId') {
            return res.json({
                "jsonrpc": "2.0",
                "id": body.id,
                "result": CHAIN_ID
            })
        }
        if (body.method != 'eth_blockNumber' && body.method != 'eth_getBlockByNumber' && body.method != 'eth_call') {
            var { data } = await axios.post(RPC, body)
            return res.json(data)
        }


        if (CACHE_RPC.COUNT_KEY >= 10000) {
            CACHE_RPC = {
                COUNT_KEY: 0
            }
        }

        var key = body.method
        if (body.method == 'eth_getBlockByNumber') {
            if (!body.params[0]) {
                return res.json({
                    "jsonrpc": "2.0",
                    "id": body.id,
                    "error": {
                        "code": -32602,
                        "message": "invalid argument 0: empty hex string"
                    }
                })
            }
            key += body.params[0]
        }

        if (body.method == 'eth_call') {
            try {
                var params = JSON.stringify(body.params)
                key += crypto.createHash('md5').update(params).digest('hex');
            }
            catch (ex) {
                var { data } = await axios.post(RPC, body)
                return res.json(data)
            }
        }

        if (!CACHE_RPC[key]) {
            CACHE_RPC.COUNT_KEY++;
        }

        CACHE_RPC[key] = CACHE_RPC[key] || {
            time: 0,
            old: timeCache,
            value: 0,
            isLoading: false
        }

        for (var i = 0; i < 5; i++) {
            if (CACHE_RPC[key].isLoading) {
                await sleep(Math.round(timeWait / 5))
            }
            else {
                break;
            }
        }

        if (CACHE_RPC[key].time + CACHE_RPC[key].old <= new Date().getTime()) {
            CACHE_RPC[key].isLoading = true
            var { data } = await axios.post(RPC, body)
            if (data !== null || data !== undefined) {
                CACHE_RPC[key].time = new Date().getTime()
                CACHE_RPC[key].value = data
            }
            CACHE_RPC[key].isLoading = false
        }

        if (CACHE_RPC[key].value == null || CACHE_RPC[key].value == undefined) {
            return res.json({
                "jsonrpc": "2.0",
                "id": body.id,
                "error": {
                    "code": -32602,
                    "message": "cannot get data"
                }
            })
        }
        else {
            res.json({
                ...CACHE_RPC[key].value,
                "id": body.id
            })
        }
    })
}