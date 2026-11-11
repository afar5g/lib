let sona
let u
let ws

class SonaUtil {

	now() {
		return performance.now() / 1000
	}

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

	num(str) {
		// returns the first number in a string, returns null if no number found
		
		const match = str.match(/[-+]?\d*\.?\d+/)
		return match ? parseFloat(match[0]) : null
	}

}

class SonaWs {

	#ws // browser WebSocket object
	#wsMetaKey = "_mN"

	#started = false  // whether ws.start is called yet
	#wsReady = false
	#imListeners = new Map()
	#pendingOms = []		// pending oms to send once WebSocket opens
	
	#maxMessageSize  // max allowed utf8 *byte* length of final json string
	#limits


	#error(method, message) {
		console.log(`sona.ws.${method} error: ${message}`)
	}

	start(appName) {

		if (this.#wsMetaKey !== "_mN") {
			return this.#error("start", `wsMetaKey variable must be set to "_mN"`)
		}

		if (appName === undefined) {
			return this.#error("start", "must specify all arguments")
		}


		// hostname includes subdomains if any
		const hostname = window.location.hostname

		const ws = new WebSocket(`wss://${hostname}:443/${appName}`)
		this.#ws = ws
		ws.binaryType = "arraybuffer"

		const _this = this

		ws.onmessage = function(event) {

			try {

				// get incoming message string then convert to JSON object
				const json = JSON.parse(event.data)

				// can be just imName or also general metadata for entire app
				const metadata = json[_this.#wsMetaKey]
				delete json[_this.#wsMetaKey]

				const imName = metadata[0]
				if (metadata[1]) {

					_this.#maxMessageSize = metadata[1]
					const shortInterval = metadata[2]
					_this.#limits = {
						wsBytes: { max: metadata[3], value: metadata[4], time: metadata[5], interval: shortInterval},
						wsMessages: { max: metadata[6], value: metadata[7], time: metadata[8], interval: shortInterval},
						dailyWsBytes: { max: metadata[9], value: metadata[10], time: metadata[11], interval: 86400},
						dailyWsMessages: { max: metadata[12], value: metadata[13], time: metadata[14], interval: 86400}
					}

					const pendingOms = _this.#pendingOms
					if (pendingOms.length > 0) {

						for (const om of pendingOms) {
							_this.#sendJson(om)
						}

						_this.#pendingOms = []
					}

					_this.#wsReady = true
				}

				const imListener = _this.#imListeners.get(imName)
				if (!imListener) return

				imListener(json)

			} catch {
				return
			}
		}

		this.#started = true
	}

	listen(name, callback) {

		// Listens for incoming messages. name means im name

		if (!this.#started) return this.#error("listen", "must call ws.start first")
		if (name === "") return this.#error("listen", "name cannot be an empty string")

		this.#imListeners.set(name, callback)
	}

	#enforceTimeLimits(bytesToSend) {

		const limits = this.#limits
		const now = performance.now() / 1000

		for (const [name, limit] of Object.entries(limits)) {
			if (now - limit.time > limit.interval) {
				limit.time = now
				limit.value = 0
			}
		}

		limits.wsBytes.value += bytesToSend
		limits.wsMessages.value++
		limits.dailyWsBytes.value += bytesToSend
		limits.dailyWsMessages.value++

		for (const [name, limit] of Object.entries(limits)) {
			if (limit.value > limit.max) return name
		}

		return false
	}

	#sendJson(om) {

		const jsonStr = JSON.stringify(om.json)

		//@slow
		const utf8ByteLength = new TextEncoder().encode(jsonStr).length

		// ensure json string utf8 size stays below server limit
		if (utf8ByteLength > this.#maxMessageSize) {
			return errorCallback("messageSize")
		}

		const limitResult = this.#enforceTimeLimits(utf8ByteLength)
		if (limitResult !== false) {
			return errorCallback(limitResult)
		}
		
		this.#ws.send(jsonStr)
	}

	send(name, json, errorCallback) {

		// Sends a JSON message to the server

		if (!this.#started) return this.#error("send", "must call ws.start first")

		const wsMetaKey = this.#wsMetaKey

		// ensure json doesn't already have the wsMetaKey
		if (Object.hasOwn(json, wsMetaKey)) {
			return ws.#error("send", `cannot have the ${wsMetaKey} key in json object`)
		}

		json[wsMetaKey] = name // insert om name

		const om = {
			name: name,
			json: json,
			error: errorCallback
		}

		if (!this.#wsReady) {
			this.#pendingOms.push(om)
		} else {
			this.#sendJson(om)
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

		this.u = new SonaUtil()
		this.ws = new SonaWs()
	}

}

sona = new Sona()
u = sona.u
ws = sona.ws