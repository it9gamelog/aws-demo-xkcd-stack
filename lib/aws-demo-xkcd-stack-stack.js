const { Stack, Duration } = require('aws-cdk-lib');

const lambda = require('aws-cdk-lib/aws-lambda');
const lambdaNodejs = require('aws-cdk-lib/aws-lambda-nodejs');

const { CfnOutput } = require('aws-cdk-lib');

const apigwv2 = require('@aws-cdk/aws-apigatewayv2-alpha');
const { HttpLambdaIntegration } = require('@aws-cdk/aws-apigatewayv2-integrations-alpha');

const amplify = require('@aws-cdk/aws-amplify-alpha');
const codecommit = require('aws-cdk-lib/aws-codecommit');

class AwsDemoXkcdStackStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);


    const fn = new lambdaNodejs.NodejsFunction(this, 'service', {
      entry: 'app/index.js',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_16_X,
    });

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

    const amplifyApp = new amplify.App(this, 'XkcdApp', {
      sourceCodeProvider: new amplify.CodeCommitSourceCodeProvider({
        repository: codecommit.Repository.fromRepositoryName(this, 'Repo', 'aws-demo-xkcd-vue'),
      }),
      environmentVariables: { VITE_API: httpApi.url },
    })
    amplifyApp.addBranch('main');
  }
}

module.exports = { AwsDemoXkcdStackStack }
