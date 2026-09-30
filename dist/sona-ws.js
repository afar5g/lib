let sona
let u
let ws

class Sona_util {

    delay(time, func) {
        setTimeout(func, time * 1000);
    }

    time(func) {
        const t1 = performance.now()
        func()
        const dt = performance.now() - t1
        console.log("time:", dt / 1000)
    }

    random(a, b) {

		// IMPORTANT: this random function is NOT secure

        return Math.floor(Math.random() * (b - a + 1)) + a
    }

    num(str) { // returns the first number in a string, returns null if no number found
        const match = str.match(/[-+]?\d*\.?\d+/)
        return match ? parseFloat(match[0]) : null
    }

}

class Sona_ws_om {
	name
	json
}

class Sona_ws {

    #ws // JS WebSocket object
	#ws_name_key = "_mN"
	#max_message_size  // max utf8 byte length of final json string

	#started = false  // whether ws.start is called yet
	#ws_opened = false
    #im_listeners = new Map()
	#pending_oms = []		// pending oms to send once WebSocket opens


    #error(method, message) {
        console.log(`sona.ws.${method} error: ${message}`)
    }

    start(app_name, max_message_size) {

		if (this.#ws_name_key !== "_mN") {
			return this.#error("start", `ws_name_key variable must be set to "_mN"`)
		}

		if (app_name === undefined || max_message_size === undefined) {
			return this.#error("start", "must specify all arguments")
		}


		const _this = this

		this.#max_message_size = max_message_size


		// hostname includes subdomains if any
        const hostname = window.location.hostname

        const ws = new WebSocket(`wss://${hostname}:443/${app_name}`)
        this.#ws = ws
        ws.binaryType = "arraybuffer"
        

		ws.onopen = function() {

            _this.#ws_opened = true

			const pending_oms = _this.#pending_oms

			if (pending_oms.length > 0) {

				for (const om of pending_oms) {
					_this.#send_json(om.json)
				}

				_this.#pending_oms = []
			}
        }


        ws.onmessage = function(event) {

			try {

				// get incoming message string then convert to JSON object
				const json = JSON.parse(event.data)

				const im_name = json[_this.#ws_name_key]
				delete json[_this.#ws_name_key]

				const im_listener = _this.#im_listeners.get(im_name)
				if (!im_listener) return

				im_listener(json)
			
			} catch {
				return
			}
        }

		this.#started = true
    }

    listen(name, callback) {

		// Listens for incoming messages. name means im name

		if (!this.#started) {
			return this.#error("listen", "must call ws.start first")
		}

        this.#im_listeners.set(name, callback)
    }

	#send_json(json) {

		const json_str = JSON.stringify(json)

		//@slow
		const utf8_byte_len = new TextEncoder().encode(json_str).length

		// ensure json string utf8 size stays below server limit
		if (utf8_byte_len > this.#max_message_size) {
			return this.#error("send", "message too large for server")
		}
		
		this.#ws.send(json_str)
	}

    send(name, json) {

		// Sends a JSON message to the server

		if (!this.#started) {
			return this.#error("send", "must call ws.start first")
		}

		const ws_name_key = this.#ws_name_key

		// ensure json doesn't already have the ws_name_key
		if (Object.hasOwn(json, ws_name_key)) {
			return ws.#error("send", `cannot have the ${ws_name_key} key in json object`)
		}

		json[ws_name_key] = name // insert om name

		if (!this.#ws_opened) {

			const om = new Sona_ws_om()
			om.name = name
			om.json = json
			
			this.#pending_oms.push(om)

		} else {

			this.#send_json(json)
		}
    }

}

class Sona {

    u
    ws

    constructor() {

		if (sona) {
			console.log("sona error: sona was already created, do not create it again. sona stopped running.")
			return
		}

        this.u = new Sona_util()
        this.ws = new Sona_ws()
    }

}

sona = new Sona()
u = sona.u
ws = sona.ws