import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as path from "path";
import * as fs from "fs";

import { buildSync } from "esbuild";

buildSync({
    bundle: true,
    entryPoints: [path.resolve(__dirname, "api", "lambda", "index.ts")],
    external: ["aws-sdk"],
    format: "cjs",
    outfile: path.join(__dirname, "api", "dist", "index.js"),
    platform: "node",
    sourcemap: true,
    target: "node22.0",
});

const config = JSON.parse(fs.readFileSync("./api/config.json", "utf-8"));

const role = new aws.iam.Role("lambdaRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});

new aws.iam.RolePolicyAttachment("lambdaRolePolicyAttachment", {
    role: role.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

const handler = new aws.lambda.Function("handler", {
    code: new pulumi.asset.AssetArchive({
        ".": new pulumi.asset.FileArchive(path.resolve(__dirname, "api", "dist")),
    }),
    handler: `index.${config.api.handler}`,
    runtime: aws.lambda.Runtime.NodeJS22dX,
    role: role.arn,
});

const restApi = new aws.apigateway.RestApi(config.prefix, {
    description: config.description,
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: "execute-api:Invoke",
                Principal: "*",
                Resource: "arn:aws:execute-api:*:*:*",
            },
        ],
    }),
});

const resource = new aws.apigateway.Resource("resource", {
    restApi: restApi.id,
    parentId: restApi.rootResourceId,
    pathPart: "{proxy+}",
});

const method = new aws.apigateway.Method("method", {
    restApi: restApi.id,
    resourceId: resource.id,
    httpMethod: "ANY",
    authorization: "NONE",
});

const integration = new aws.apigateway.Integration("integration", {
    restApi: restApi.id,
    resourceId: resource.id,
    httpMethod: method.httpMethod,
    integrationHttpMethod: "POST",
    type: "AWS_PROXY",
    uri: handler.invokeArn,
});

const deployment = new aws.apigateway.Deployment("deployment", {
    restApi: restApi.id,
    stageName: "prod",
}, { dependsOn: [integration] });

const webAcl = new aws.wafv2.WebAcl("webAcl", {
    scope: "REGIONAL",
    defaultAction: { block: {} },
    visibilityConfig: {
        cloudwatchMetricsEnabled: true,
        metricName: "demo-APIWebACL",
        sampledRequestsEnabled: true,
    },
    rules: [
        {
            name: "demo-rateLimitRule",
            priority: 20,
            action: { block: {} },
            visibilityConfig: {
                cloudwatchMetricsEnabled: true,
                metricName: "demo-rateLimitRule",
                sampledRequestsEnabled: false,
            },
            statement: {
                rateBasedStatement: {
                    limit: 100,
                    aggregateKeyType: "IP",
                },
            },
        },
        {
            name: "demo-api-auth-gateway-geolocation-rule",
            priority: 30,
            action: { allow: {} },
            visibilityConfig: {
                cloudwatchMetricsEnabled: true,
                metricName: "demo-AuthAPIGeoLocationUS",
                sampledRequestsEnabled: false,
            },
            statement: {
                geoMatchStatement: {
                    countryCodes: ["US"],
                },
            },
        },
        {
            name: "demo-api-auth-gateway-sqli-rule",
            priority: 40,
            action: { block: {} },
            visibilityConfig: {
                cloudwatchMetricsEnabled: true,
                metricName: "demo-APIAuthGatewaySqliRule",
                sampledRequestsEnabled: false,
            },
            statement: {
                orStatement: {
                    statements: [
                        {
                            sqliMatchStatement: {
                                fieldToMatch: { allQueryArguments: {} },
                                textTransformations: [
                                    { priority: 1, type: "URL_DECODE" },
                                    { priority: 2, type: "HTML_ENTITY_DECODE" },
                                ],
                            },
                        },
                        {
                            sqliMatchStatement: {
                                fieldToMatch: { body: {} },
                                textTransformations: [
                                    { priority: 1, type: "URL_DECODE" },
                                    { priority: 2, type: "HTML_ENTITY_DECODE" },
                                ],
                            },
                        },
                        {
                            sqliMatchStatement: {
                                fieldToMatch: { uriPath: {} },
                                textTransformations: [
                                    { priority: 1, type: "URL_DECODE" },
                                ],
                            },
                        },
                    ],
                },
            },
        },
        {
            name: "demo-detect-xss",
            priority: 60,
            action: { block: {} },
            visibilityConfig: {
                cloudwatchMetricsEnabled: true,
                metricName: "demo-detect-xss",
                sampledRequestsEnabled: false,
            },
            statement: {
                orStatement: {
                    statements: [
                        {
                            xssMatchStatement: {
                                fieldToMatch: { uriPath: {} },
                                textTransformations: [
                                    { priority: 1, type: "URL_DECODE" },
                                    { priority: 2, type: "HTML_ENTITY_DECODE" },
                                ],
                            },
                        },
                        {
                            xssMatchStatement: {
                                fieldToMatch: { allQueryArguments: {} },
                                textTransformations: [
                                    { priority: 1, type: "URL_DECODE" },
                                    { priority: 2, type: "HTML_ENTITY_DECODE" },
                                ],
                            },
                        },
                    ],
                },
            },
        },
    ],
});

new aws.wafv2.WebAclAssociation("webAclAssociation", {
    resourceArn: pulumi.interpolate`arn:aws:apigateway:${aws.config.region}::/restapis/${restApi.id}/stages/prod`,
    webAclArn: webAcl.arn,
});

