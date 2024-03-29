import { App } from '@aws-cdk/core'
import { LambdaSourcecodeStorageStack } from './lambda-sourcecode-storage'

export const SourceCodeStackName = `${process.env.STACK_ID ||
	'udi-waiting-time'}-sourcecode`

/**
 * In order to deploy lambda functions we need to publish them on an S3 bucket.
 * This app provides the bucket and run before the main app.
 */
export class SourceCodeApp extends App {
	constructor() {
		super()

		new LambdaSourcecodeStorageStack(this, SourceCodeStackName)
	}
}
