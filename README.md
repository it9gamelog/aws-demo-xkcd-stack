# Introduction

Creating a fullstack, serverless solution for https://xkcd.com/221/, https://xkcd.com/426/

Demo: https://www.youtube.com/watch?v=OPl48WMHFgo

Frontend Repo: https://github.com/it9gamelog/aws-demo-xkcd-vue

# Implementation

## System Initialization

Install AWS CLI and bootstrap CDK if not done already.

```sh
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

aws configure

npm install -g aws-cdk
cdk bootstrap  # Once per region
```

## Initialization

```sh
mkdir xkcd
cd xkcd
cdk init --language=javascript
# For lambda to be packaged as JS instead of Lambda
npm install esbuild --save
```

## Create application v1: Implements xkcd 221

### Create our own app package

```sh
mkdir app
cd app
npm init
```

```js
// File: app/index.js (New)
// https://xkcd.com/221/
function getRandomNumber()
{
  return 4; // chosen by fair dice roll. 
            // guaranteed to be random.
}

exports.handler =  async function(event, context) {
  if (event.rawPath == "/rolldice") return getRandomNumber();
  return { statusCode: 500, body: "Unknown request" };
}
```

### Stack

Construct the Lammbda NodeJS using L2 construct

CDK Documentation: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html

```js
// File: lib/*stack.js (Add Header)
const lambda = require('aws-cdk-lib/aws-lambda');
const lambdaNodejs = require('aws-cdk-lib/aws-lambda-nodejs');
```

```js
// File: lib/*stack.js (Add Content)
    const fn = new lambdaNodejs.NodejsFunction(this, 'service', {
      entry: 'app/index.js',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_16_X,
    });
```

### Deploy

```sh
cdk deploy
```

### Verify

#### Console

Go to CloudFormation
Go to Stack > Resources > the Lambda function

#### Test

Test with the following payload

```json
{"rawPath":"/rolldice"}
```

Should get 
```
4
```

#### Live Test

Configuration > Funciton URL

Hit the URL with /rolldice, should get `4`

## Create application v1: Implements xkcd 426

### Application

Put some more code

```js
// File: app/index.js (Modify)

const djia = require('djia').default;
const md5 = require('md5');

// https://stackoverflow.com/a/5055821/78025
const hex2dec = (hex) => {
  hex = hex.split(/\./);
  var len = hex[1].length;
  hex[1] = parseInt(hex[1], 16);
  hex[1] *= Math.pow(16, -len);
  return parseInt(hex[0], 16) + hex[1];
}

// djia callback converts to async
const asyncDjia = async (date) => {
  return new Promise((resolve, error)  => {
    djia(date, (err, value) => {
      if (value) resolve(value);
      error(err)
    })
  })
}

// https://xkcd.com/426/
const geohash = async (date) => {
  const opening = await asyncDjia(date);
  const hash = md5(`${date}-${opening}`);
  const latOffset = hex2dec(`0.${hash.substr(0,16)}`);
  const lonOffset = hex2dec(`0.${hash.substr(16)}`);
  return {opening, hash, latOffset, lonOffset};
};

exports.handler =  async function(event, context) {
  // Add new path to handle
  // URL: /geohash/{date}
  if (event.rawPath.startsWith("/geohash/")) return geohash(event.pathParameters.date);

  if (event.rawPath == "/rolldice") return handleRollDice();
  return { statusCode: 500, body: "Unknown request" };
}
```

Install two dependencies

```sh
npm install djia --save
npm install md5 --save
```

### Stack

Need a few more alpha constructs

```sh
npm install @aws-cdk/aws-apigatewayv2-alpha --save-dev
npm install @aws-cdk/aws-apigatewayv2-integrations-alpha --save-dev
```

```js
// File: lib/*stack.js (Add Header)

const { CfnOutput } = require('aws-cdk-lib');

const apigwv2 = require('@aws-cdk/aws-apigatewayv2-alpha');
const { HttpLambdaIntegration } = require('@aws-cdk/aws-apigatewayv2-integrations-alpha');
```

```js
// File: lib/*stack.js (Add Content)

    // djia needs HOME for caching
    const fn = new lambdaNodejs.NodejsFunction(this, 'service', {
      entry: 'app/index.js',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_16_X,
      // Add this line
      environment: { HOME: '/tmp' },
    });      

    // API Gateway v2
    // Cheaper to use the new HTTP (v2) instead of Rest (v1)
    const integration = new HttpLambdaIntegration('service', fn);
    const httpApi = new apigwv2.HttpApi(this, 'xkcd', { corsPreflight: { allowOrigins: ['*'] }});
    httpApi.addRoutes({
        path: '/geohash/{date}',
        methods: [ apigwv2.HttpMethod.GET ],
        integration: integration,
    });
    httpApi.addRoutes({
        path: '/rolldice',
        methods: [ apigwv2.HttpMethod.GET ],
        integration: integration,
    });

    new CfnOutput(this, 'ApiUrl', { value: httpApi.url });
```

### Deploy

```sh
cdk deploy
```

### Verify

#### Lambda Test

{"rawPath":"/rolldice"}
{"rawPath":"/geohash","pathParameters":{"date":"2005-05-26"}}

#### API Gateway Test

/geohash/2005-05-26
https://xkcd.com/426/

## Making a Frontend

### Using Vue 3

```sh
npm init vue@latest
# Project name: aws-demo-xkcd-vue
cd aws-demo-xkcd-vue
npm install
```

### Replacing the component code

```html
<!--File: src/components/TheWelcome.vue (Replace)-->

<script setup>
import { ref } from 'vue';
const api = import.meta.env.VITE_API;
const output = ref("");

async function rollDice() {
  output.value = "Rolling...";
  const resp = await fetch(`${api}/rolldice`);
  output.value = await resp.text();
}

async function geohash() {
  output.value = "Loading...";
  const dateval = document.querySelector('#geodate').value;
  const resp = await fetch(`${api}/geohash/${dateval}`);
  const val = await resp.json();
  output.value = JSON.stringify(val, null, 2);
}
</script>

<template>
  <h2>Roll</h2>
  <button @click="rollDice()">Roll Dice!</button>

  <h2>Geohashing</h2>
  <input type="date" id="geodate" @change="geohash()">

  <h2>Output</h2>
  <pre>{{ output }}</pre>
</template>
```

### Build

```
npm run dev
```

### Commit

Create a CodeCommit repo

Then commit the code

```sh
git init
git add .
git commit -m init
git branch -m main
git remote add origin codecommit::ap-northeast-1://aws-demo-xkcd-vue
git push origin main
```

### Stack

Back to the CDK directory, install another alpha construct
```sh
npm install @aws-cdk/aws-amplify-alpha
```

```js
// File: lib/*stack.js (Add Header)
const amplify = require('@aws-cdk/aws-amplify-alpha');
const codecommit = require('aws-cdk-lib/aws-codecommit');
```

```js
// File: lib/*stack.js (Adopt)
    const amplifyApp = new amplify.App(this, 'XkcdApp', {
      sourceCodeProvider: new amplify.CodeCommitSourceCodeProvider({
        repository: codecommit.Repository.fromRepositoryName(this, 'Repo', 'aws-demo-xkcd-vue'),
      }),
      environmentVariables: { VITE_API: httpApi.url },
    })
    amplifyApp.addBranch('main');
```

### Deploy

```
cdk deploy
```

### Verify

1. Go to amplify
2. Force to Run Build
3. Wait
3. Profit! (Visit the URL provided)

## Cleanup

1. Removing the stack
   ```
   cdk destroy
   ```
1. Delete the CodeCommit repo
