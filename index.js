/*****************
 * Configuration *
 *****************/

/**
 * Порт, используемый для локального прокси-longpoll-сервера.
 */
const PORT = 4006;

/**
 * User-agent для запросов к ВКонтакте.
 * <s>Можно не менять, от него ничего не зависит</s>.
 * Зависит - если UA от официального приложения - будет
 * меньше ограничений (например, будут отдаваться прямые
 * ссылки на видеозаписи).
 */
const USER_AGENT = "VKAndroidApp/4.38-849 (Android 6.0; SDK 23; x86; Google Nexus 5X; ru)";




/***********************************
 *                                 *
 *     DO NOT TOUCH CODE BELOW     *
 *                                 *
 ***********************************/

const http = require("http");
const https = require("https");
const url = require("url");
const qs = require("querystring");

const VERSION = 2;

const CorsHeaders = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, GET"
};

const sendResponse = (response, body) => {
	response.writeHead(200, {
		"content-type": "application/json; charset=utf-8",
		...CorsHeaders
	});
	response.write(body);
	response.end();
};

const proxy = (request, response, host, path) => {
	const headers = request.headers;

	const options = {
		hostname: host,
		path: path,
		method: request.method,
		headers: {
			"user-agent": USER_AGENT,
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"accept-language": "en-US,en;q=0.5",
			"connection": "keep-alive",
			"referer": "https://vk.com/",
			"origin": "https://vk.com",
			"cookie": "",
		},
		rejectUnauthorized: false,
	};

	if (headers['content-type']) {
		options.headers['content-type'] = headers['content-type'];
	}

	const proxyRequest = https.request(options, proxyResponse => {
		response.writeHead(proxyResponse.statusCode, {
			...proxyResponse.headers,
			...CorsHeaders
		});
		proxyResponse.pipe(response, {
			end: true
		});
	});


	request.pipe(proxyRequest, {
		end: true
	});
};


let countRequests = 0;

const onRequest = (request, response) => {
	const parsedUrl = url.parse(request.url, true);
	const GET = parsedUrl.query;

	let host = request.host;
	let path = parsedUrl.pathname;

	countRequests++;

	switch (parsedUrl.pathname) {
		case "/ack": {
			sendResponse(response, JSON.stringify({status: true, version: VERSION}));
			return;
		}

		case "/favicon.ico": {
			sendResponse(response, ".");
			return;
		}

		case "/longpoll": {
			if (!GET.server) {
				sendResponse(response, 'wtf');
				return;
			} 
			[host, path] = GET.server.split("/");
			proxy(request, response, host, "/" + path + "?" + qs.stringify({
				act: "a_check",
				wait: 25,
				mode: 66,
				key: GET.key,
				ts: GET.ts,
				version: GET.version || "1",
			}));
			return;
		}

		default: {
			proxy(request, response, "api.vk.com", request.url);
		}
	}
};

console.log(`APIdog Local LongPoll Proxy (version ${VERSION})`);
console.log("Starting LLPP...");
http.createServer(onRequest).listen(PORT);
console.log(`LLPP successfully started on port ${PORT}...`);

//const symbols = [" ", "░", "▒", "▓", "█", "▓", "▒", "░"];
const symbols = ["|", "/", "-", "\\"];
let s = 0;

setInterval(() => {
	process.stdout.write(`\r${symbols[s % symbols.length]} working... ${countRequests} requests handled`);
	s++;
}, 200);
