import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'

export const loadUrl = (url: string) =>
	fetch(url)
		.then(res => res.text())
		.then(html => new JSDOM(html))
