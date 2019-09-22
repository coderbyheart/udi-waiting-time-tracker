import { JSDOM } from 'jsdom'

export const select = (dom: JSDOM, selector: string) => {
	const waitTimeElement = dom.window.document.querySelector(selector)
	if (waitTimeElement) {
		return waitTimeElement.textContent!.trim()
	}
	return 'unknown'
}
