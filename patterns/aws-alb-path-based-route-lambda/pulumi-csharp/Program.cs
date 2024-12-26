using System.Collections.Generic;
using Pulumi;
using Aws = Pulumi.Aws;

return await Deployment.RunAsync(() =>
{

    // Create a new VPC with two subnets (one per Availability Zone)
    var vpc = new Aws.Ec2.Vpc("DemoVPC", new Aws.Ec2.VpcArgs
    {
        CidrBlock = "10.0.0.0/16",
        EnableDnsSupport = true,
        EnableDnsHostnames = true,
    });

    // Create subnets
    var subnet1 = new Aws.Ec2.Subnet("Subnet1", new Aws.Ec2.SubnetArgs
    {
        VpcId = vpc.Id,
        CidrBlock = "10.0.1.0/24",
        AvailabilityZone = "us-west-2a",
    });

    var subnet2 = new Aws.Ec2.Subnet("Subnet2", new Aws.Ec2.SubnetArgs
    {
        VpcId = vpc.Id,
        CidrBlock = "10.0.2.0/24",
        AvailabilityZone = "us-west-2b",
    });

    // Create an AWS Lambda function
    var lambdaFunction1 = new Aws.Lambda.Function("MyLambdaFunction1", new Aws.Lambda.FunctionArgs
    {
        Runtime = Aws.Lambda.Runtime.NodeJS22dX,
        Handler = "index.handler",
        Code = new FileArchive("./src/Lambda1.zip"),
        VpcConfig = new Aws.Lambda.Inputs.FunctionVpcConfigArgs
        {
            SubnetIds = { subnet1.Id, subnet2.Id },
            SecurityGroupIds = { },
        },
    });

    // Create an AWS Lambda function
    var lambdaFunction2 = new Aws.Lambda.Function("MyLambdaFunction2", new Aws.Lambda.FunctionArgs
    {
        Runtime = Aws.Lambda.Runtime.NodeJS22dX,
        Handler = "index.handler",
        Code = new FileArchive("./src/Lambda2.zip"),
        VpcConfig = new Aws.Lambda.Inputs.FunctionVpcConfigArgs
        {
            SubnetIds = { subnet1.Id, subnet2.Id },
            SecurityGroupIds = { },
        },
    });

    // Create an Application Load Balancer
    var loadBalancer = new Aws.LB.LoadBalancer("MyLoadBalancer", new Aws.LB.LoadBalancerArgs
    {
        Subnets = { subnet1.Id, subnet2.Id },
        LoadBalancerType = "application",
        Internal = false,
    });

    // Create target group for Lambda
    var targetGroup1 = new Aws.LB.TargetGroup("MyTargetGroup1", new Aws.LB.TargetGroupArgs
    {
        TargetType = "lambda",
        VpcId = vpc.Id,
    });

        // Create target group for Lambda
    var targetGroup2 = new Aws.LB.TargetGroup("MyTargetGroup2", new Aws.LB.TargetGroupArgs
    {
        TargetType = "lambda",
        VpcId = vpc.Id,
    });


    var targetGroupAttachment1 = new Aws.LB.TargetGroupAttachment("MyTargetGroupAttachment1", new Aws.LB.TargetGroupAttachmentArgs
    {
        TargetGroupArn = targetGroup1.Arn,
        TargetId = lambdaFunction1.Arn,
    });

    var targetGroupAttachment2 = new Aws.LB.TargetGroupAttachment("MyTargetGroupAttachment2", new Aws.LB.TargetGroupAttachmentArgs
    {
        TargetGroupArn = targetGroup2.Arn,
        TargetId = lambdaFunction2.Arn,
    });

    // Create an ALB listener
    var listener = new Aws.LB.Listener("MyListener", new Aws.LB.ListenerArgs
    {
        LoadBalancerArn = loadBalancer.Arn,
        Port = 80,
        DefaultActions =
        {
            new Aws.LB.Inputs.ListenerDefaultActionArgs
            {
                Type = "fixed-response",
                FixedResponse = new Aws.LB.Inputs.ListenerDefaultActionFixedResponseArgs
                {
                    ContentType = "text/plain",
                    MessageBody = "Default response from ALB!!!",
                    StatusCode = "200",
                },
            },
        },
    });

    // Path-based route
    var listenerRule1 = new Aws.LB.ListenerRule("service-listener-rule-1", new Aws.LB.ListenerRuleArgs
    {
        ListenerArn = listener.Arn,
        Priority = 100,
        Actions =
        {
            new Aws.LB.Inputs.ListenerRuleActionArgs
            {
                Type = "forward",
                TargetGroupArn = targetGroup1.Arn,
            },
        },
        Conditions =
        {
            new Aws.LB.Inputs.ListenerRuleConditionArgs
            {
                PathPattern = new Aws.LB.Inputs.ListenerRuleConditionPathPatternArgs
                {
                    Values = { "/api/service1*" },
                },
            },
        },
    });

    // Path-based route
    var listenerRule2 = new Aws.LB.ListenerRule("service-listener-rule-2", new Aws.LB.ListenerRuleArgs
    {
        ListenerArn = listener.Arn,
        Priority = 101,
        Actions =
        {
            new Aws.LB.Inputs.ListenerRuleActionArgs
            {
                Type = "forward",
                TargetGroupArn = targetGroup2.Arn,
            },
        },
        Conditions =
        {
            new Aws.LB.Inputs.ListenerRuleConditionArgs
            {
                PathPattern = new Aws.LB.Inputs.ListenerRuleConditionPathPatternArgs
                {
                    Values = { "/api/service2*" },
                },
            },
        },
    });

    // Allow the Application Load Balancer to access Lambda Function
    var permission1 = new Aws.Lambda.Permission("WithLBFunction1", new Aws.Lambda.PermissionArgs
    {
        Action = "lambda:InvokeFunction",
        Principal = "elasticloadbalancing.amazonaws.com",
        Function = lambdaFunction1.Name,
        SourceArn = targetGroup1.Arn,
    });

    // Allow the Application Load Balancer to access Lambda Function
    var permission2 = new Aws.Lambda.Permission("WithLBFunction2", new Aws.Lambda.PermissionArgs
    {
        Action = "lambda:InvokeFunction",
        Principal = "elasticloadbalancing.amazonaws.com",
        Function = lambdaFunction2.Name,
        SourceArn = targetGroup2.Arn,
    });

    // Define an output for the ALB URL
    return new Dictionary<string, object?>
    {
        { "ALBUrl", loadBalancer.DnsName },
    };

});
