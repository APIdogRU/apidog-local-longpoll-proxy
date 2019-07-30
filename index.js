/*****************
 * Configuration *
 *****************/

/**
 * Порт, используемый для локального прокси-longpoll-сервера.
 */
const PORT = 4006;

/**
 * User-agent для запросов к ВКонтакте. Можно не менять, от него ничего не зависит
 */
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0";




/***********************************
 *                                 *
 *     DO NOT TOUCH CODE BELOW     *
 *                                 *
 ***********************************/

const http = require("http");
const https = require("https");
const url = require("url");
const qs = require("querystring");

const VERSION = 1;

const sendResponse = (response, body) => {
	response.writeHead(200, {
		"content-type": "application/json; charset=utf-8",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "POST, GET",
	});
	response.write(body);
	response.end();
};

const proxy = (request, response, host, path) => {
	const options = {
		hostname: host,
		path: path,
		method: request.method,
		headers: {
			"user-agent": USER_AGENT,
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"accept-language": "en-US,en;q=0.5",
			"accept-encoding": "gzip, deflate",
			"connection": "keep-alive",
		},
		rejectUnauthorized: false
	};

	request.pipe(https.request(options, proxyResponse => {
		const headers = { ...proxyResponse.headers };
		headers["access-control-allow-origin"] = "*";
		headers["access-control-allow-methods"] = "POST, GET";
		response.writeHead(proxyResponse.statusCode, headers);
		proxyResponse.pipe(response, { end: true });
	}), { end: true });
};

let countRequests = 0;

const onRequest = (request, response) => {

	const parsedUrl = url.parse(request.url, true);
	const GET = parsedUrl.query;

	//process.stdout.write("\r" + parsedUrl.pathname + "\n");

	let host = request.host;
	let path = parsedUrl.pathname;

	countRequests++;

	switch (parsedUrl.pathname) {
		case "/ack":
			sendResponse(response, JSON.stringify({status: true, version: VERSION}));
			return;

		case "/favicon.ico":
			sendResponse(response, "fail");
			return;

		case "/longpoll":
			[host, path] = GET.server.split("/");
			proxy(request, response, host, "/" + path + "?" + qs.stringify({
				act: "a_check",
				wait: 25,
				mode: 2,
				key: GET.key,
				ts: GET.ts,
				version: GET.version || "1"
			}));
			return;

		default:
	}

	proxy(request, response, "api.vk.com", request.url);
};

process.stdout.write(
`     ▓▓      ▓▓▓▓▓▓▓  ▓▓      ▓▓
    ▓▓▓▓     ▓▓    ▓▓ ▓▓      ▓▓
   ▓▓  ▓▓    ▓▓    ▓▓ ▓▓      ▓▓  
  ▓▓    ▓▓   ▓▓ ▓▓▓▓  ▓▓  ▓▓▓▓▓▓ ▓░░░░░▓  ▓▓▓▓▓ 
 ▓▓  ▓▓▓▓▓▓  ▓▓       ▓▓ ▓▓   ▓▓ ▓▓░░░▓▓ ▓▓   ▓▓
 ▓▓      ▓▓  ▓▓       ▓▓ ▓▓   ▓▓ ▓▓▓░▓▓▓ ▓▓   ▓▓
▓▓        ▓▓ ▓▓       ▓▓  ▓▓▓▓▓  ▓▓▓▓▓▓▓  ▓▓▓▓▓▓
                                              ▓▓
                                          ▓▓▓▓▓\n`);
console.log(`APIdog Local LongPoll Proxy (version ${VERSION})`);
console.log("Starting LLPP...");
http.createServer(onRequest).listen(PORT);
console.log(`LLPP successfully started on port ${PORT}...`);

const symbols = [" ", "░", "▒", "▓", "█", "▓", "▒", "░"];
let s = 0;

setInterval(() => {
	process.stdout.write(`\r${symbols[s % symbols.length]} working... ${countRequests} requests handled`);
	s++;
}, 200);