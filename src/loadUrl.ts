import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'

export const loadUrl = async (url: string) =>
	fetch(url)
		.then(async res => res.text())
		.then(html => new JSDOM(html))
