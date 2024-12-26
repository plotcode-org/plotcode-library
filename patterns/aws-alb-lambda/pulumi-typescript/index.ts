import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

// Create a VPC with public subnets
const myVpc = new awsx.ec2.Vpc("MyVPC", {
    numberOfAvailabilityZones: 1,
});

// Create a security group
const securityGroup = new aws.ec2.SecurityGroup("MyLoadBalancerSG", {
    vpcId: myVpc.vpcId,
    ingress: [
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
});

// Create an Application Load Balancer
const loadBalancer = new aws.lb.LoadBalancer("MyLoadBalancer", {
    securityGroups: [securityGroup.id],
    subnets: myVpc.publicSubnetIds,
    loadBalancerType: "application",
    enableDeletionProtection: false,
    internal: false,
});

// Create a Lambda function
const lambdaRole = new aws.iam.Role("lambdaRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});

const lambdaPolicy = new aws.iam.RolePolicyAttachment("lambdaPolicy", {
    role: lambdaRole.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

const lambdaFunction = new aws.lambda.Function("LambdaFunction", {
    runtime: aws.lambda.Runtime.NodeJS22dX,
    code: new pulumi.asset.AssetArchive({
        ".": new pulumi.asset.FileArchive('lambda'),
    }),
    handler: "index.handler",
    role: lambdaRole.arn,
});

// Create a target group
const targetGroup = new aws.lb.TargetGroup("MyLoadBalancerTargets", {
    port: 80,
    protocol: "HTTP",
    targetType: "lambda",
    vpcId: myVpc.vpcId,
    healthCheck: {
        enabled: true,
    },
    });

    // Attach the Lambda function to the target group
    const targetGroupAttachment = new aws.lb.TargetGroupAttachment("MyLoadBalancerTargetAttachment", {
        targetGroupArn: targetGroup.arn,
        targetId: lambdaFunction.arn,
});

// Create a listener
const listener = new aws.lb.Listener("MyLoadBalancerListener", {
    loadBalancerArn: loadBalancer.arn,
    port: 80,
    defaultActions: [
        {
            type: "forward",
            targetGroupArn: targetGroup.arn,
        },
    ],
});

// Export the URL of the load balancer
export const albUrl = pulumi.interpolate`http://${loadBalancer.dnsName}`;
