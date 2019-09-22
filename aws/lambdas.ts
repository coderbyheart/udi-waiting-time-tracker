import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from './packLambdas'

export type Lambdas = LayeredLambdas<{
	trackWaitTime: string
}>

export const lambdas = async (
	rootDir: string,
	outDir: string,
	Bucket: string,
): Promise<Lambdas> =>
	packLayeredLambdasForCloudFormation('emailTestApi', outDir, Bucket, {
		trackWaitTime: path.resolve(rootDir, 'src', 'trackWaitTime.ts'),
	})
