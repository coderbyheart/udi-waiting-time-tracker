## Setup

[![Greenkeeper badge](https://badges.greenkeeper.io/coderbyheart/udi-waiting-time-tracker.svg)](https://greenkeeper.io/)

	npm ci           # install dependencies
	npx tsc          # compile the TypeScript files
	
	# if this is the run the first time in an account
	npx cdk -a 'node dist/aws/cloudformation-sourcecode.js' deploy
    	
	npx cdk deploy   # deploy the stack to your AWS account
