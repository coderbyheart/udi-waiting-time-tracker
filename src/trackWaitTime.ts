import fetch from 'node-fetch'
import {
	DynamoDBClient,
	GetItemCommand,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { select } from './select'
import { loadUrl } from './loadUrl'

const db = new DynamoDBClient({})
const WAIT_TIME_TABLE = process.env.WAIT_TIME_TABLE!
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL!
const UDI_URL = process.env.UDI_URL!
const WAIT_TIME_SELECTOR =
	process.env.WAIT_TIME_SELECTOR ||
	'body > div.container > div.row.content > div > div > div > div > p > strong'
const LAST_UPDATED_SELECTOR =
	process.env.LAST_UPDATED_TIME ||
	'body > div.container > div.row.content > div > div > div > div:nth-child(2) > p'

export const handler = async () => {
	const site = await loadUrl(UDI_URL)

	const waitTime = select(site, WAIT_TIME_SELECTOR)
	const lastUpdated = select(site, LAST_UPDATED_SELECTOR)

	console.log(
		JSON.stringify({
			waitTime,
			lastUpdated,
			url: UDI_URL,
		}),
	)

	const waitTimeString = `${waitTime} (${lastUpdated})`

	const { Item } = await db.send(
		new GetItemCommand({
			TableName: WAIT_TIME_TABLE,
			Key: {
				url: {
					S: UDI_URL,
				},
			},
		}),
	)

	if (Item && Item.waitTime.S === waitTimeString) {
		console.log('Wait time unchanged.')
		return
	}

	console.log('Wait time changed.')

	await db.send(
		new PutItemCommand({
			TableName: WAIT_TIME_TABLE,
			Item: {
				url: {
					S: UDI_URL,
				},
				waitTime: {
					S: waitTimeString,
				},
				createdAt: {
					S: new Date().toISOString(),
				},
			},
		}),
	)

	await fetch(SLACK_WEBHOOK_URL, {
		method: 'POST',
		body: JSON.stringify({
			text: `The UDI wait time changed to: *${waitTimeString}*! <${UDI_URL}|Click here> for details.`,
			icon_url: 'https://www.udi.no/Resources/Internal/img/udi_logo.png',
			username: 'UDI',
		}),
		headers: {
			'Content-Type': 'application/json',
		},
	})
}
