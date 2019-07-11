import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import {
	DynamoDBClient,
	GetItemCommand,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'

const db = new DynamoDBClient({})
const WAIT_TIME_TABLE = process.env.WAIT_TIME_TABLE!
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL!
const UDI_URL = process.env.UDI_URL!
const SELECTOR = process.env.SELECTOR || 'body > div.container > div.row.content > div > div > div > div > p > strong'

const getCurrentWaitTime = (url: string) => fetch(url)

export const handler = async () => {

	const waitTime = await getCurrentWaitTime(UDI_URL)
		.then(res => res.text())
		.then(html => new JSDOM(html))
		.then(dom => {
			const waitTimeElement = dom.window.document.querySelector(SELECTOR)
			if (waitTimeElement) {
				return waitTimeElement.textContent!.trim()
			}
			return 'unknown'
		})

	console.log(JSON.stringify({
		waitTime,
		url: UDI_URL,
	}))

	const { Item } = await db.send(new GetItemCommand({
		TableName: WAIT_TIME_TABLE,
		Key: {
			url: {
				S: UDI_URL,
			},
		},
	}))

	if (Item && Item.waitTime.S === waitTime) {
		console.log('Wait time unchanged.')
		return
	}

	console.log('Wait time changed.')

	await db.send(new PutItemCommand({
		TableName: WAIT_TIME_TABLE,
		Item: {
			url: {
				S: UDI_URL,
			},
			waitTime: {
				S: waitTime,
			},
			createdAt: {
				S: new Date().toISOString(),
			},
		},
	}))

	await fetch(SLACK_WEBHOOK_URL, {
		method: 'POST',
		body: JSON.stringify({
			text: `The UDI wait time changed to: *${waitTime}*! <${UDI_URL}|Click here> for details.`,
			icon_url: 'https://www.udi.no/Resources/Internal/img/udi_logo.png',
			username: 'UDI',
		}),
		headers: {
			'Content-Type': 'application/json',
		},
	})
}
