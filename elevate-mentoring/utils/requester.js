const http = require('http')
const https = require('https')
const { matchPathsAndExtractParams } = require('../utils/patternMatcher')
const routesConfig = require('../constants/routes')
const { pathParamSetter } = require('../utils/pathParamSetter')
const axios = require('axios')

const handleInterfaceError = (res, err) => {
	console.log('Error: ', err)
	res.writeHead(500, { 'Content-Type': 'text/plain' })
	res.end('Interface Server Error')
}

const passThroughRequester = async (req, res) => {
	try {
		const sourceBaseUrl = req.protocol + '://' + req.headers.host + '/'
		const sourceUrl = new URL(req.originalUrl, sourceBaseUrl)
		const route = routesConfig.routes.find((route) => route.sourceRoute === req.sourceRoute)
		const params = matchPathsAndExtractParams(route.sourceRoute, req.originalUrl)
		const targetRoute = pathParamSetter(route.targetRoute.path, params)
		const parsedUrl = new URL(targetRoute, req.baseUrl)
		const options = {
			method: req.method,
			headers: req.headers,
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.pathname + sourceUrl.search,
		}
		console.log({
			sourceBaseUrl,
			sourceUrl,
			route,
			params,
			targetRoute,
			parsedUrl,
			options,
		})
		const proxyReq = (parsedUrl.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
			res.writeHead(proxyRes.statusCode, proxyRes.headers)
			proxyRes.pipe(res, { end: true })
		})
		proxyReq.on('error', (err) => {
			handleInterfaceError(res, err)
		})
		req.pipe(proxyReq, { end: true })
	} catch (err) {
		handleInterfaceError(res, err)
	}
}

const post = (baseUrl, route, requestBody, headers) => {
	const url = baseUrl + route
	return axios
		.post(url, requestBody, { headers })
		.then((response) => response.data)
		.catch((error) => {
			if (error.response) {
				return error.response
			}
			return error
		})
}

const requesters = {
	passThroughRequester,
	post,
}

module.exports = requesters
