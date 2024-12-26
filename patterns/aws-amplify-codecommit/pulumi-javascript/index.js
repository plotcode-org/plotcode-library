"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const fs = require("fs");


// Create a new CodeCommit Repository from a local repository or folder
const repo = new aws.codecommit.Repository("Repository", {
    repositoryName: "webapp-repository",
    repositoryDescription: "Repository for webapp",
});

// Create an IAM Role that gives Amplify permission to pull from CodeCommit
const amplifyRole = new aws.iam.Role("AmplifyRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "amplify.amazonaws.com" }),
    inlinePolicies: [{
        name: "CodeCommit",
        policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Action: ["codecommit:GitPull"],
                Effect: "Allow",
                Resource: "*",
            }],
        }),
    }],
});

// Optional: set backend endpoint URL. This is static for the example, but can also be dynamically retrieved
const api_url = "SAMPLE_BACKEND_API_URL";

// Create the Amplify web app. Set repository as the code commit repo. Optional: Pass backend endpoint URL to the front end code via Amplify environment variables
const amplifyApp = new aws.amplify.App("AmplifyApp", {
    name: "codecommit-amplify-webApp",
    repository: repo.cloneUrlHttp,
    platform: "WEB",
    iamServiceRoleArn: amplifyRole.arn,
    buildSpec: fs.readFileSync("./buildspec.yml").toString(),
    environmentVariables: {
        API_URL: api_url,
    },
});

// Create a new Amplify Branch
const amplifyBranch = new aws.amplify.Branch("AmplifyBranch", {
    appId: amplifyApp.id,
    branchName: "main",
    stage: "PRODUCTION",
    enableAutoBuild: true,
});

// Create an IAM role for a custom resource, Amplify Job
const customResourceRole = new aws.iam.Role("CustomResourceRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});

// Give the custom resource IAM role permissions to Amplify
new aws.iam.RolePolicy("CustomResourceRolePolicy", {
    role: customResourceRole.id,
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: ["amplify:*"],
            Effect: "Allow",
            Resource: "*", // Adjust the ARN accordingly
        }],
    }),
});

// Create a Custom Resource that creates an Amplify job. This job will pull from the Amplify branch created above, and build the web application.
const amplifyJob = new aws.cloudformation.Stack("amplifyJob", {
    templateBody: JSON.stringify({
        Resources: {
            AmplifyJob: {
                Type: "Custom::AmplifyJob",
                Properties: {
                    ServiceToken: customResourceRole.arn,
                    AppId: amplifyApp.id,
                    BranchName: "main",
                    JobType: "RELEASE",
                },
            },
        },
    }),
});

// Optional: Output web app URL for later use
exports.webAppUrl = pulumi.interpolate`https://main.${amplifyApp.defaultDomain}`;
exports.appId = amplifyApp.id;
