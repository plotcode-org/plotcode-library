import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const region = aws.config.region || "us-west-2";
const accountId = aws.getCallerIdentity().then(identity => identity.accountId);

const parameter = new aws.ssm.Parameter("ParameterConstruct", {
    type: "String",
    value: new Date().toISOString(),
});

const corsRole = new aws.iam.Role("CorsRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});

const corsFunc = new aws.lambda.Function("CorsFunction", {
    runtime: aws.lambda.Runtime.NodeJS22dX,
    code: new pulumi.asset.AssetArchive({
        ".": new pulumi.asset.FileArchive("functions"),
    }),
    handler: "index.handler",
    role: corsRole.arn,
    environment: {
        variables: {
            VERSION: parameter.value,
            REGION: region,
            ACCOUNT_NUMBER: accountId,
        },
    },
});

const api = new aws.apigatewayv2.Api("APIGw", {
    protocolType: "HTTP",
});

const integration = new aws.apigatewayv2.Integration("Integration", {
    apiId: api.id,
    integrationType: "AWS_PROXY",
    integrationUri: corsFunc.arn,
    integrationMethod: "POST",
});

new aws.apigatewayv2.Route("Route", {
    apiId: api.id,
    routeKey: "ANY /{proxy+}",
    target: pulumi.interpolate`integrations/${integration.id}`,
});

new aws.apigatewayv2.Stage("Stage", {
    apiId: api.id,
    name: "$default",
    autoDeploy: true,
});
