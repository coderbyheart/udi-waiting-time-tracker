import { PolicyStatement, ServicePrincipal } from '@aws-cdk/aws-iam'
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs'
import { promises as fs } from 'fs'
import { App, Duration, RemovalPolicy, Stack } from '@aws-cdk/core'
import * as path from 'path'
import {
	AttributeType,
	BillingMode,
	StreamViewType,
	Table,
} from '@aws-cdk/aws-dynamodb'
import { Bucket } from '@aws-cdk/aws-s3'
import { Code, Function, LayerVersion, Runtime } from '@aws-cdk/aws-lambda'
import { lambdas, Lambdas } from './lambdas'
import { LambdaSourcecodeStorageStack } from './lambda-sourcecode-storage'
import { packBaseLayer } from '@bifravst/package-layered-lambdas'
import { LambdaFunction } from '@aws-cdk/aws-events-targets'
import { Rule, Schedule } from '@aws-cdk/aws-events'

const STACK_ID = process.env.STACK_ID || 'udi-waiting-time'

export class UdiWaitingTimeStack extends Stack {
	constructor(
		parent: App,
		id: string,
		props: {
			sourceCodeBucketName: string
			baseLayerZipFileName: string
			layeredLambdas: Lambdas
		},
	) {
		super(parent, id)

		const { sourceCodeBucketName, baseLayerZipFileName, layeredLambdas } = props

		const waitTimeTable = new Table(this, 'waitTimeTable', {
			tableName: `${id}-waitTime`,
			billingMode: BillingMode.PAY_PER_REQUEST,
			stream: StreamViewType.NEW_IMAGE,
			partitionKey: {
				name: 'url',
				type: AttributeType.STRING,
			},
		})

		const sourceCodeBucket = Bucket.fromBucketAttributes(
			this,
			'SourceCodeBucket',
			{
				bucketName: sourceCodeBucketName,
			},
		)

		const baseLayer = new LayerVersion(this, `${id}-layer`, {
			code: Code.bucket(sourceCodeBucket, baseLayerZipFileName),
			compatibleRuntimes: [Runtime.NODEJS_10_X],
		})

		const trackWaitTime = new Function(this, 'trackWaitTime', {
			code: Code.bucket(
				sourceCodeBucket,
				layeredLambdas.lambdaZipFileNames.trackWaitTime,
			),
			layers: [baseLayer],
			handler: 'index.handler',
			runtime: Runtime.NODEJS_10_X,
			timeout: Duration.seconds(300),
			memorySize: 1792,
			environment: {
				WAIT_TIME_TABLE: waitTimeTable.tableName,
			},
			initialPolicy: [
				new PolicyStatement({
					resources: [waitTimeTable.tableArn],
					actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
				}),
				new PolicyStatement({
					resources: [`arn:aws:logs:*:*:*`],
					actions: [
						'logs:CreateLogGroup',
						'logs:CreateLogStream',
						'logs:PutLogEvents',
					],
				}),
			],
			description: 'Index tweet tags',
		})

		const rule = new Rule(this, 'InvokeTrackWaitTime', {
			schedule: Schedule.expression('cron(0 0 * * ? *)'),
			description: 'Check the wait time',
			enabled: true,
			targets: [new LambdaFunction(trackWaitTime)],
		})

		trackWaitTime.addPermission('InvokeByEvents', {
			principal: new ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})

		new LogGroup(this, `LogGroup`, {
			retention: RetentionDays.ONE_WEEK,
			logGroupName: `/aws/lambda/${trackWaitTime.functionName}`,
			removalPolicy: RemovalPolicy.DESTROY,
		})
	}
}

class UdiWaitingTimeApp extends App {
	constructor(props: {
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		layeredLambdas: Lambdas
	}) {
		super()
		new UdiWaitingTimeStack(this, STACK_ID, props)
	}
}

const main = async () => {
	const outDir = path.resolve(__dirname, '..', '..', 'pack')
	try {
		await fs.stat(outDir)
	} catch (_) {
		await fs.mkdir(outDir)
	}
	const rootDir = path.resolve(__dirname, '..', '..')

	const Bucket = await LambdaSourcecodeStorageStack.getBucketName(
		`${STACK_ID}-sourcecode`,
	)

	new UdiWaitingTimeApp({
		sourceCodeBucketName: Bucket,
		baseLayerZipFileName: await packBaseLayer({
			srcDir: rootDir,
			outDir,
			Bucket,
		}),
		layeredLambdas: await lambdas(rootDir, outDir, Bucket),
	}).synth()
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
